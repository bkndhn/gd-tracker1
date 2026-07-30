import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PAGE = 1000;
const MAX_ROWS = 100_000;

interface Payload {
  /** ISO date strings */
  from?: string;
  to?: string;
  /** Ordered custom_field ids to render as columns; defaults to display order */
  fieldIds?: string[];
  /** Extra recipients — the caller's own address is always included */
  recipients?: string[];
  format?: 'xlsx' | 'csv';
  subject?: string;
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    // Caller-scoped client: every read below is filtered by the tenant's RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;
    const callerEmail = (claimsData.claims.email as string) || '';

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, name, email, status')
      .eq('id', userId)
      .single();

    if (!profile || !['admin', 'manager', 'super_admin'].includes(profile.role)) {
      return json({ error: 'Insufficient permissions' }, 403);
    }
    if (profile.status && profile.status !== 'active') {
      return json({ error: 'Account is not active' }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const format = body.format === 'csv' ? 'csv' : 'xlsx';

    // ---- Recipients (validated, caller always included) -------------------
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = Array.from(
      new Set(
        [callerEmail, profile.email, ...(body.recipients || [])]
          .map(r => (r || '').trim().toLowerCase())
          .filter(r => emailRe.test(r) && r.length <= 255),
      ),
    ).slice(0, 10);
    if (recipients.length === 0) return json({ error: 'No valid recipient address' }, 400);

    // ---- Field definitions -------------------------------------------------
    const { data: fieldRows, error: fieldErr } = await supabase
      .from('custom_fields')
      .select('id, name, display_order')
      .is('deleted_at', null)
      .order('display_order');
    if (fieldErr) throw fieldErr;

    const fieldById = new Map((fieldRows || []).map((f: any) => [f.id, f]));
    const orderedFields = (body.fieldIds?.length
      ? body.fieldIds.map(id => fieldById.get(id)).filter(Boolean)
      : fieldRows || []) as Array<{ id: string; name: string }>;

    const { data: optionRows } = await supabase
      .from('custom_field_options')
      .select('id, value')
      .is('deleted_at', null);
    const optionText = new Map((optionRows || []).map((o: any) => [o.id, o.value]));

    // ---- Entries (paginated so very large tenants stream through) ----------
    const entries: any[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      let q = supabase
        .from('goods_damaged_entries')
        .select('id, created_at, employee_name, notes')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (body.from) q = q.gte('created_at', body.from);
      if (body.to) q = q.lte('created_at', body.to);

      const { data, error } = await q;
      if (error) throw error;
      entries.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }

    // ---- Custom values for those entries -----------------------------------
    const valuesByEntry: Record<string, Record<string, string>> = {};
    for (let i = 0; i < entries.length; i += 200) {
      const ids = entries.slice(i, i + 200).map(e => e.id);
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('gd_entry_custom_values')
          .select('gd_entry_id, custom_field_id, custom_field_option_id, value')
          .in('gd_entry_id', ids)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        (data || []).forEach((row: any) => {
          const text = row.custom_field_option_id ? optionText.get(row.custom_field_option_id) : row.value;
          if (text === null || text === undefined || text === '') return;
          (valuesByEntry[row.gd_entry_id] ||= {})[row.custom_field_id] = String(text);
        });
        if (!data || data.length < PAGE) break;
      }
    }

    const headers = ['S.No', 'Date & Time', 'Reporter', ...orderedFields.map(f => f.name), 'Notes'];
    const rows = entries.map((e, i) => [
      i + 1,
      new Date(e.created_at).toLocaleString('en-GB'),
      e.employee_name || 'Unknown',
      ...orderedFields.map(f => valuesByEntry[e.id]?.[f.id] || ''),
      e.notes || '',
    ]);

    // ---- Build the file ----------------------------------------------------
    const stamp = new Date().toISOString().split('T')[0];
    let fileBytes: Uint8Array;
    let fileName: string;
    let contentType: string;

    if (format === 'csv') {
      const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
      fileBytes = new TextEncoder().encode('\uFEFF' + csv);
      fileName = `gd_report_${stamp}.csv`;
      contentType = 'text/csv';
    } else {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'GD Tracker';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('GD Report', { views: [{ state: 'frozen', ySplit: 1 }] });

      sheet.addRow(headers);
      sheet.columns = headers.map((h, i) => ({
        width: i === 0 ? 8 : i === headers.length - 1 ? 40 : Math.max(14, Math.min(30, h.length + 6)),
      })) as any;

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 24;

      rows.forEach(r => sheet.addRow(r));
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

      const buffer = await workbook.xlsx.writeBuffer();
      fileBytes = new Uint8Array(buffer as ArrayBuffer);
      fileName = `gd_report_${stamp}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    // ---- Deliver by email --------------------------------------------------
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ error: 'Email delivery is not configured (missing RESEND_API_KEY)' }, 500);

    const range =
      body.from || body.to
        ? `${body.from ? new Date(body.from).toLocaleDateString('en-GB') : 'start'} – ${body.to ? new Date(body.to).toLocaleDateString('en-GB') : 'today'}`
        : 'All time';

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px;border-radius:12px 12px 0 0;color:#fff">
          <h1 style="margin:0;font-size:20px">Your GD report is ready</h1>
          <p style="margin:6px 0 0;opacity:.9;font-size:13px">Generated ${new Date().toLocaleString('en-GB')}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;color:#111827">
          <p style="margin-top:0">Hi ${profile.name || 'there'},</p>
          <p>The full export you requested is attached as <strong>${fileName}</strong>.</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280">Rows</td><td style="text-align:right"><strong>${rows.length}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Columns</td><td style="text-align:right"><strong>${headers.length}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Date range</td><td style="text-align:right"><strong>${range}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">File size</td><td style="text-align:right"><strong>${(fileBytes.length / 1024).toFixed(0)} KB</strong></td></tr>
          </table>
          <p style="color:#6b7280;font-size:12px;margin-bottom:0">Generated automatically by GD Tracker. Data is scoped to your account only.</p>
        </div>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'GD Tracker <onboarding@resend.dev>',
        to: recipients,
        subject: body.subject?.slice(0, 150) || `GD Report — ${rows.length} entries (${range})`,
        html,
        attachments: [{ filename: fileName, content: base64FromBytes(fileBytes) }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend error', res.status, detail);
      return json({ error: 'Email delivery failed', detail: detail.slice(0, 300) }, 502);
    }

    return json({
      success: true,
      rows: rows.length,
      columns: headers.length,
      fileName,
      contentType,
      sizeBytes: fileBytes.length,
      recipients,
    });
  } catch (error: any) {
    console.error('export-report-email error:', error);
    return json({ error: error?.message || 'Export failed' }, 500);
  }
});
