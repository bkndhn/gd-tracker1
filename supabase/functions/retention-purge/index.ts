import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

interface RetentionPolicy {
  months: number; // 0 = keep forever
  purge_audit_logs?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const cronHeader = req.headers.get('x-cron-secret');
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET;
    if (!isCron) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Every admin's retention policy lives in app_settings under 'retention_policy'
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('admin_id, value')
      .eq('key', 'retention_policy');
    if (error) throw error;

    const results: any[] = [];

    for (const s of settings || []) {
      const policy = s.value as RetentionPolicy;
      const months = Number(policy?.months || 0);
      if (!s.admin_id || !months || months <= 0) {
        results.push({ admin_id: s.admin_id, skipped: true });
        continue;
      }

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffIso = cutoff.toISOString();

      try {
        // Entries older than the cutoff for this tenant
        const { data: oldEntries } = await supabase
          .from('goods_damaged_entries')
          .select('id, voice_note_url')
          .eq('admin_id', s.admin_id)
          .lt('created_at', cutoffIso)
          .limit(2000);

        const entryIds = (oldEntries || []).map((e: any) => e.id);
        let storageRemoved = 0;

        if (entryIds.length > 0) {
          // Collect storage objects before deleting DB rows
          const { data: images } = await supabase
            .from('gd_entry_images')
            .select('image_url')
            .in('gd_entry_id', entryIds);
          const { data: evidence } = await supabase
            .from('entry_evidence')
            .select('storage_path')
            .in('entry_id', entryIds);

          const imagePaths = (images || [])
            .map((i: any) => i.image_url?.split('/gd-entry-images/')[1])
            .filter(Boolean);
          const voicePaths = (oldEntries || [])
            .map((e: any) => e.voice_note_url?.split('/gd-voice-notes/')[1])
            .filter(Boolean);
          const evidencePaths = (evidence || []).map((e: any) => e.storage_path).filter(Boolean);

          if (imagePaths.length) {
            const { error: e1 } = await supabase.storage.from('gd-entry-images').remove(imagePaths);
            if (!e1) storageRemoved += imagePaths.length;
          }
          if (voicePaths.length) {
            const { error: e2 } = await supabase.storage.from('gd-voice-notes').remove(voicePaths);
            if (!e2) storageRemoved += voicePaths.length;
          }
          if (evidencePaths.length) {
            const { error: e3 } = await supabase.storage.from('lsi-evidence').remove(evidencePaths);
            if (!e3) storageRemoved += evidencePaths.length;
          }

          // Child rows first, then entries
          await supabase.from('gd_entry_images').delete().in('gd_entry_id', entryIds);
          await supabase.from('gd_entry_custom_values').delete().in('gd_entry_id', entryIds);
          await supabase.from('entry_evidence').delete().in('entry_id', entryIds);
          await supabase.from('follow_ups').delete().in('entry_id', entryIds);
          await supabase.from('goods_damaged_entries').delete().in('id', entryIds);
        }

        let auditPurged = 0;
        if (policy.purge_audit_logs) {
          const { count } = await supabase
            .from('audit_logs')
            .delete({ count: 'exact' })
            .lt('created_at', cutoffIso);
          auditPurged = count || 0;
        }

        await supabase.from('audit_logs').insert({
          user_id: s.admin_id,
          user_email: 'system',
          action: 'settings_changed',
          target_type: 'retention_purge',
          details: {
            months,
            cutoff: cutoffIso,
            entries_deleted: entryIds.length,
            storage_objects_removed: storageRemoved,
            audit_logs_purged: auditPurged,
          },
        });

        results.push({ admin_id: s.admin_id, months, entries_deleted: entryIds.length, storageRemoved, auditPurged });
      } catch (e) {
        results.push({ admin_id: s.admin_id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
