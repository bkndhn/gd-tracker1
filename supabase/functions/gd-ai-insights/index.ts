// deno-lint-ignore-file
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ---- In-memory rate limiter (per user, sliding window) ----
// 20 requests per 60s per user; also 5 per 10s burst guard.
const rlWindow = new Map<string, number[]>();
const RL_MAX_PER_MIN = 20;
const RL_BURST = 5;
const RL_BURST_WINDOW = 10_000;
const RL_WINDOW = 60_000;

function checkRateLimit(userId: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const arr = (rlWindow.get(userId) || []).filter(t => now - t < RL_WINDOW);
  const burst = arr.filter(t => now - t < RL_BURST_WINDOW).length;
  if (burst >= RL_BURST) return { ok: false, retryAfter: 10 };
  if (arr.length >= RL_MAX_PER_MIN) return { ok: false, retryAfter: 60 };
  arr.push(now);
  rlWindow.set(userId, arr);
  return { ok: true };
}

// ---- Response cache (LRU-ish, 5 min TTL) ----
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; text: string }>();

async function hashKey(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(key); return null; }
  return hit.text;
}
function cacheSet(key: string, text: string) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), text });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonRes = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
    });

  try {
    if (!LOVABLE_API_KEY) return jsonRes({ error: 'AI key missing' }, 500);

    // ---- Auth: require signed-in user ----
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return jsonRes({ error: 'Unauthorized' }, 401);

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userData?.user) return jsonRes({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    // ---- Load caller profile + tenant AI toggle ----
    const { data: prof } = await supa
      .from('profiles')
      .select('id, role, status, deleted_at, ai_enabled, admin_id')
      .eq('id', userId)
      .maybeSingle();
    if (!prof || (prof as any).deleted_at || (prof as any).status === 'paused') {
      return jsonRes({ error: 'Account not available' }, 403);
    }
    const role = (prof as any).role as string;
    // Only admin / manager / super_admin may use AI insights
    if (!['admin', 'manager', 'super_admin'].includes(role)) {
      return jsonRes({ error: 'AI insights not permitted for your role' }, 403);
    }
    // Effective AI toggle: super_admin bypasses; others use their tenant admin's ai_enabled.
    if (role !== 'super_admin') {
      const tenantId = role === 'admin' ? userId : (prof as any).admin_id;
      let aiEnabled = true;
      if (role === 'admin') aiEnabled = (prof as any).ai_enabled !== false;
      else if (tenantId) {
        const { data: adminRow } = await supa
          .from('profiles').select('ai_enabled, status, deleted_at')
          .eq('id', tenantId).maybeSingle();
        aiEnabled = !!adminRow && (adminRow as any).ai_enabled !== false
          && !(adminRow as any).deleted_at && (adminRow as any).status !== 'paused';
      }
      if (!aiEnabled) return jsonRes({ error: 'AI Insights disabled for your organization' }, 403);
    }

    // ---- Rate limit ----
    const rl = checkRateLimit(userId);
    if (!rl.ok) return jsonRes(
      { error: `Rate limit exceeded. Try again in ${rl.retryAfter}s.` },
      429,
      { 'Retry-After': String(rl.retryAfter) },
    );

    // ---- Body ----
    const { mode, context, data, question } = await req.json();
    if (!['summary', 'ask'].includes(mode)) return jsonRes({ error: 'Invalid mode' }, 400);
    if (!['dashboard', 'reports'].includes(context)) return jsonRes({ error: 'Invalid context' }, 400);
    if (mode === 'ask' && (!question || typeof question !== 'string' || question.length > 500)) {
      return jsonRes({ error: 'Invalid question (max 500 chars)' }, 400);
    }

    const dataStr = JSON.stringify(data || {}, null, 2).slice(0, 12000);
    const cacheKey = await hashKey(`${role}|${mode}|${context}|${question || ''}|${dataStr}`);
    const cached = cacheGet(cacheKey);
    if (cached) return jsonRes({ text: cached, cached: true });

    const systemPrompt = `You are a retail damage-control analyst for a "Goods Damaged" (GD) tracking app used by shops.
You interpret aggregated GD data (by shop, category, size, customer type, notes, dates) and give concise, actionable insights.
Speak plainly. Use bullet points. Highlight anomalies, trends, top offenders, and recommend concrete actions to reduce damages.`;

    const userPrompt = mode === 'summary'
      ? `Analyze this ${context} data and produce:
1. Key stats (totals, top shop, top category, top size, top customer type)
2. Notable patterns (what's rising/falling, what's unusual)
3. 3-5 specific, actionable recommendations to reduce GD
4. Any warning signs to investigate

Data:
${dataStr}`
      : `Question: ${question}

Answer using this ${context} data. Be specific, cite numbers.

Data:
${dataStr}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('AI gateway error', resp.status, errBody);
      if (resp.status === 429) return jsonRes({ error: 'AI rate limit hit, try again shortly.' }, 429);
      if (resp.status === 402) return jsonRes({ error: 'AI credits exhausted. Please top up.' }, 402);
      return jsonRes({ error: 'AI provider error' }, 500);
    }

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content || '';
    cacheSet(cacheKey, text);

    return jsonRes({ text, cached: false });
  } catch (e: any) {
    console.error('gd-ai-insights error', e);
    return jsonRes({ error: e?.message || 'Unknown error' }, 500);
  }
});
