import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: schedules, error } = await supabase
      .from('scheduled_email_reports')
      .select('*')
      .is('deleted_at', null)
      .eq('is_enabled', true);
    if (error) throw error;

    const now = new Date();
    const results: any[] = [];

    for (const s of schedules || []) {
      try {
        // Compute "local" time in s.timezone
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: s.timezone || 'Asia/Kolkata',
          hour: '2-digit', minute: '2-digit', hour12: false,
          weekday: 'short', day: '2-digit',
        });
        const parts = fmt.formatToParts(now);
        const get = (t: string) => parts.find(p => p.type === t)?.value || '';
        const hh = get('hour').padStart(2, '0');
        const mm = get('minute');
        const weekday = get('weekday'); // Mon
        const day = parseInt(get('day'), 10);
        const scheduledHHMM = s.report_time.slice(0, 5);
        const currentHHMM = `${hh}:${mm}`;

        // Match within current 5-minute window (cron runs every 5min)
        const [sh, sm] = scheduledHHMM.split(':').map(Number);
        const [ch, cm] = currentHHMM.split(':').map(Number);
        const diff = (ch * 60 + cm) - (sh * 60 + sm);
        if (diff < 0 || diff > 5) continue;

        if (s.frequency === 'weekly' && weekday !== 'Mon') continue;
        if (s.frequency === 'monthly' && day !== 1) continue;

        // Avoid double-send within 23h
        if (s.last_sent_at) {
          const last = new Date(s.last_sent_at).getTime();
          if (now.getTime() - last < 23 * 60 * 60 * 1000) continue;
        }

        // Determine range
        const rangeStart = new Date(now);
        if (s.frequency === 'daily') rangeStart.setDate(rangeStart.getDate() - 1);
        else if (s.frequency === 'weekly') rangeStart.setDate(rangeStart.getDate() - 7);
        else rangeStart.setMonth(rangeStart.getMonth() - 1);

        const { data: entries } = await supabase
          .from('goods_damaged_entries')
          .select('id, created_at, employee_name, notes, shop_id, category_id, size_id')
          .eq('admin_id', s.admin_id)
          .gte('created_at', rangeStart.toISOString())
          .order('created_at', { ascending: false })
          .limit(500);

        const total = entries?.length || 0;
        const rows = (entries || []).slice(0, 50).map((e: any) => `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #eee">${new Date(e.created_at).toLocaleString()}</td>
            <td style="padding:6px;border-bottom:1px solid #eee">${e.employee_name || '-'}</td>
            <td style="padding:6px;border-bottom:1px solid #eee">${(e.notes || '').slice(0, 120)}</td>
          </tr>`).join('');

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
            <h2 style="color:#4f46e5">GD Report — ${s.frequency.toUpperCase()}</h2>
            <p>Period: <b>${rangeStart.toLocaleDateString()} → ${now.toLocaleDateString()}</b></p>
            <p>Total entries: <b>${total}</b></p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:6px">Time</th><th style="text-align:left;padding:6px">Reporter</th><th style="text-align:left;padding:6px">Notes</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#888">No entries</td></tr>'}</tbody>
            </table>
            <p style="color:#888;font-size:12px;margin-top:16px">Sent automatically by GD Tracker.</p>
          </div>`;

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'GD Tracker <onboarding@resend.dev>',
            to: [s.recipient_email],
            subject: `GD Report (${s.frequency}) — ${total} entries`,
            html,
          }),
        });
        const sent = resp.ok;

        if (sent) {
          await supabase.from('scheduled_email_reports')
            .update({ last_sent_at: now.toISOString() }).eq('id', s.id);
        }
        results.push({ id: s.id, sent, status: resp.status });
      } catch (err: any) {
        results.push({ id: s.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
