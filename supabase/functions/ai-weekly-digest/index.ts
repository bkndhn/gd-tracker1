// deno-lint-ignore-file
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const inr = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;

async function generateDigest(summary: string): Promise<string> {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY! },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content:
            'You are a retail operations analyst for an Indian store chain. Write a crisp weekly digest ' +
            'in plain HTML (no <html> wrapper, use <p>, <ul>, <li>, <strong>). Cover: performance of lost-sale ' +
            'follow-ups, recovered revenue, shops that need attention, and 3 concrete actions for next week. ' +
            'Max 250 words. Never invent numbers beyond the data given.',
        },
        { role: 'user', content: summary },
      ],
    }),
  });
  if (res.status === 429) throw new Error('AI rate limit reached, try again shortly');
  if (res.status === 402) throw new Error('AI credits exhausted, please top up in Settings');
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? '<p>No digest available.</p>';
}

async function buildForAdmin(supa: any, adminId: string) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const prev = new Date(Date.now() - 14 * 86400000).toISOString();

  const [fuRes, prevRes, entryRes] = await Promise.all([
    supa.from('follow_ups').select('*').eq('admin_id', adminId).gte('sent_at', since),
    supa.from('follow_ups').select('outcome, recovered_amount').eq('admin_id', adminId).gte('sent_at', prev).lt('sent_at', since),
    supa.from('goods_damaged_entries').select('id, shop_id, created_at').eq('admin_id', adminId).gte('created_at', since),
  ]);

  const fu = fuRes.data || [];
  const prevFu = prevRes.data || [];
  const recovered = fu.filter((r: any) => r.outcome === 'converted').reduce((s: number, r: any) => s + Number(r.recovered_amount || 0), 0);
  const prevRecovered = prevFu.filter((r: any) => r.outcome === 'converted').reduce((s: number, r: any) => s + Number(r.recovered_amount || 0), 0);

  const byShop: Record<string, { sent: number; converted: number; recovered: number }> = {};
  fu.forEach((r: any) => {
    const k = r.shop_name || 'Unknown shop';
    byShop[k] ||= { sent: 0, converted: 0, recovered: 0 };
    byShop[k].sent++;
    if (r.outcome === 'converted') { byShop[k].converted++; byShop[k].recovered += Number(r.recovered_amount || 0); }
  });

  const byReason: Record<string, number> = {};
  fu.forEach((r: any) => { const k = r.reason_label || 'Not specified'; byReason[k] = (byReason[k] || 0) + 1; });

  const stats = {
    visits: (entryRes.data || []).length,
    followUpsSent: fu.length,
    pending: fu.filter((r: any) => r.outcome === 'pending').length,
    converted: fu.filter((r: any) => r.outcome === 'converted').length,
    recovered,
    prevRecovered,
  };

  const summary = [
    `Week ending ${new Date().toDateString()}.`,
    `Lost-sale visits logged: ${stats.visits}.`,
    `Follow-ups sent: ${stats.followUpsSent}; converted: ${stats.converted}; still pending: ${stats.pending}.`,
    `Recovered revenue: ${inr(stats.recovered)} (previous week ${inr(stats.prevRecovered)}).`,
    `By shop: ${Object.entries(byShop).map(([s, v]) => `${s}: ${v.sent} sent, ${v.converted} converted, ${inr(v.recovered)}`).join('; ') || 'no activity'}.`,
    `Top lost reasons: ${Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} (${v})`).join(', ') || 'none'}.`,
  ].join('\n');

  return { stats, summary };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (!LOVABLE_API_KEY) return json({ error: 'AI key missing' }, 500);
    if (!RESEND_API_KEY) return json({ error: 'Email key missing' }, 500);

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const cronHeader = req.headers.get('x-cron-secret');
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET;

    let targets: { adminId: string; email: string }[] = [];

    if (isCron) {
      const { data } = await supa
        .from('profiles')
        .select('id, email')
        .eq('role', 'admin')
        .eq('status', 'active')
        .is('deleted_at', null);
      targets = (data || []).filter((p: any) => p.email).map((p: any) => ({ adminId: p.id, email: p.email }));
    } else {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token) return json({ error: 'Unauthorized' }, 401);
      const { data: userData, error: userErr } = await supa.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

      const { data: prof } = await supa
        .from('profiles')
        .select('id, role, email, admin_id, status, deleted_at, ai_enabled')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (!prof || (prof as any).deleted_at || (prof as any).status === 'paused') return json({ error: 'Account not available' }, 403);
      if (!['admin', 'super_admin'].includes((prof as any).role)) return json({ error: 'Admins only' }, 403);
      if ((prof as any).ai_enabled === false) return json({ error: 'AI disabled for your organization' }, 403);

      const adminId = (prof as any).role === 'admin' ? (prof as any).id : ((prof as any).admin_id || (prof as any).id);
      if (!(prof as any).email) return json({ error: 'No email on your profile' }, 400);
      targets = [{ adminId, email: (prof as any).email }];
    }

    let sent = 0;
    for (const t of targets) {
      const { stats, summary } = await buildForAdmin(supa, t.adminId);
      if (!isCron || stats.visits > 0 || stats.followUpsSent > 0) {
        const body = await generateDigest(summary);
        const html = `
          <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111">
            <h2 style="margin:0 0 4px">Weekly lost-sale digest</h2>
            <p style="color:#666;margin:0 0 16px;font-size:13px">${new Date().toDateString()}</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
              <tr><td style="padding:6px;border:1px solid #eee">Visits logged</td><td style="padding:6px;border:1px solid #eee"><b>${stats.visits}</b></td></tr>
              <tr><td style="padding:6px;border:1px solid #eee">Follow-ups sent</td><td style="padding:6px;border:1px solid #eee"><b>${stats.followUpsSent}</b></td></tr>
              <tr><td style="padding:6px;border:1px solid #eee">Converted</td><td style="padding:6px;border:1px solid #eee"><b>${stats.converted}</b></td></tr>
              <tr><td style="padding:6px;border:1px solid #eee">Recovered revenue</td><td style="padding:6px;border:1px solid #eee"><b>${inr(stats.recovered)}</b></td></tr>
            </table>
            ${body}
          </div>`;

        const mail = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Lost Sale Insights <onboarding@resend.dev>',
            to: [t.email],
            subject: `Weekly digest — ${inr(stats.recovered)} recovered, ${stats.followUpsSent} follow-ups`,
            html,
          }),
        });
        if (mail.ok) sent++;
        else console.error('resend error', await mail.text());
      }
    }

    return json({ ok: true, sent, message: `Weekly digest sent to ${sent} recipient(s)` });
  } catch (e) {
    console.error('ai-weekly-digest error', e);
    return json({ error: (e as Error).message || 'Digest failed' }, 500);
  }
});
