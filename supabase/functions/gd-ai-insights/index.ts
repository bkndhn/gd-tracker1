// deno-lint-ignore-file
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI key missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { mode, context, data, question } = await req.json();

    const dataStr = JSON.stringify(data || {}, null, 2).slice(0, 12000);

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
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limit hit, try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please top up in Lovable settings.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI provider error', details: errBody }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ text }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('gd-ai-insights error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
