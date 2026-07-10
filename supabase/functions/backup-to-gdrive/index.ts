// deno-lint-ignore-file
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const GDRIVE_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY')!;
const GATEWAY = 'https://connector-gateway.lovable.dev/google_drive';

const TABLES = [
  'profiles', 'shops', 'categories', 'sizes', 'customer_types',
  'goods_damaged_entries', 'gd_entry_images', 'gd_entry_custom_values',
  'custom_fields', 'custom_field_options', 'app_settings', 'scheduled_email_reports',
];

async function dumpAllTables(supabase: any) {
  const dump: Record<string, any> = {};
  for (const t of TABLES) {
    const rows: any[] = [];
    let from = 0;
    const chunk = 1000;
    while (true) {
      const { data, error } = await supabase.from(t).select('*').range(from, from + chunk - 1);
      if (error) { dump[t] = { error: error.message }; break; }
      rows.push(...(data || []));
      if (!data || data.length < chunk) { dump[t] = rows; break; }
      from += chunk;
    }
  }
  return dump;
}

async function uploadJsonToDrive(filename: string, content: string) {
  const boundary = '----lovable-gd-backup-' + crypto.randomUUID();
  const metadata = { name: filename, mimeType: 'application/json' };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    content + `\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${GATEWAY}/upload/drive/v3/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GDRIVE_KEY,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive upload failed [${res.status}]: ${text}`);
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify caller is super_admin (when called by user)
    const authHeader = req.headers.get('Authorization');
    const isCron = req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET');

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (!isCron) {
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(jwt);
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if ((prof as any)?.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const started = Date.now();
    const dump = await dumpAllTables(supabase);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gd-backup-${ts}.json`;
    const payload = JSON.stringify({
      generated_at: new Date().toISOString(),
      version: 1,
      note: 'Full metadata backup. Image files remain in Supabase storage buckets (gd-entry-images, gd-voice-notes).',
      tables: dump,
    }, null, 2);

    const uploaded = await uploadJsonToDrive(filename, payload);

    const took = Date.now() - started;
    return new Response(JSON.stringify({
      ok: true,
      filename,
      driveFileId: uploaded.id,
      sizeBytes: payload.length,
      tookMs: took,
      trigger: isCron ? 'cron' : 'manual',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('backup-to-gdrive error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
