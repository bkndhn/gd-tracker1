import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const EVIDENCE_BUCKET = 'lsi-evidence';
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export interface EvidenceItem {
  id: string;
  entry_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  caption: string | null;
  created_at: string;
  url: string;
}

/** Evidence (images / PDFs) attached to one lost-sale visit. */
export const useEntryEvidence = (entryId: string | null) => {
  const { profile } = useAuth();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const role = (profile as any)?.role;
  const adminId = role === 'admin' || role === 'super_admin' ? profile?.id : (profile as any)?.admin_id;

  const load = useCallback(async () => {
    if (!entryId) { setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase.from('entry_evidence') as any)
        .select('*')
        .eq('entry_id', entryId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const paths = rows.map(r => r.storage_path);
      let signed: Record<string, string> = {};
      if (paths.length) {
        const { data: urls } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrls(paths, 3600);
        (urls || []).forEach((u, i) => { if (u.signedUrl) signed[paths[i]] = u.signedUrl; });
      }
      setItems(rows.map(r => ({ ...r, url: signed[r.storage_path] || '' })));
    } catch (e) {
      if (import.meta.env.DEV) console.error('useEntryEvidence load', e);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => { load(); }, [load]);

  const upload = useCallback(async (file: File, caption?: string) => {
    if (!entryId) throw new Error('No visit selected');
    if (!adminId) throw new Error('No admin context');
    if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) throw new Error('Only images or PDF files are allowed');
    if (file.size > MAX_EVIDENCE_BYTES) throw new Error('File must be under 10 MB');

    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-60);
      const path = `${adminId}/${entryId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error } = await (supabase.from('entry_evidence') as any).insert({
        admin_id: adminId,
        entry_id: entryId,
        uploaded_by: profile?.id,
        storage_path: path,
        file_name: file.name.slice(0, 120),
        mime_type: file.type,
        file_size: file.size,
        caption: caption || null,
      });
      if (error) {
        await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
        throw error;
      }
      await load();
    } finally {
      setUploading(false);
    }
  }, [entryId, adminId, profile?.id, load]);

  const remove = useCallback(async (item: EvidenceItem) => {
    const { error } = await (supabase.from('entry_evidence') as any).delete().eq('id', item.id);
    if (error) throw error;
    await supabase.storage.from(EVIDENCE_BUCKET).remove([item.storage_path]);
    await load();
  }, [load]);

  return { items, loading, uploading, upload, remove, reload: load };
};

/** Counts of evidence per entry, for badges in list views. */
export const useEvidenceCounts = (entryIds: string[]) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = entryIds.slice(0, 300).join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) { setCounts({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from('entry_evidence') as any)
        .select('entry_id')
        .in('entry_id', ids);
      if (cancelled) return;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.entry_id] = (map[r.entry_id] || 0) + 1; });
      setCounts(map);
    })();
    return () => { cancelled = true; };
  }, [key]);

  return counts;
};
