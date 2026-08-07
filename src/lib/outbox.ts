/**
 * Offline outbox: WhatsApp-style "queued message" delivery for GD entries.
 *
 * An entry created offline is stored locally with its images / voice note as
 * blobs, shown immediately in the UI as "pending", and pushed to Supabase as
 * soon as connectivity returns. Delivery is resumable: partial progress
 * (entry row created, N images uploaded) is persisted so a retry never
 * duplicates data.
 */

import { supabase } from '@/integrations/supabase/client';
import { idb, OUTBOX_STORE } from './offlineDb';

/** Ask the service worker to retry later, even if the app gets closed. */
async function requestBrowserRetry() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg: any = await navigator.serviceWorker.ready;
    await reg?.sync?.register('outbox-sync');
  } catch {
    /* Background Sync unsupported — in-app timers still retry */
  }
}


export interface OutboxCustomValue {
  custom_field_id: string;
  custom_field_option_id?: string | null;
  value?: string | null;
}

export interface OutboxAttachment {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export type OutboxStatus = 'pending' | 'sending' | 'failed';

export interface OutboxItem {
  id: string;
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  /** Preview text shown in the queue sheet. */
  label: string;
  entry: {
    shop_id: string;
    employee_id: string;
    employee_name: string;
    notes: string;
    admin_id: string;
  };
  customValues: OutboxCustomValue[];
  images: OutboxAttachment[];
  voiceNote?: OutboxAttachment | null;
  /** Resume markers so retries are idempotent. */
  remoteEntryId?: string | null;
  uploadedImageCount?: number;
  voiceUploaded?: boolean;
  customValuesSaved?: boolean;
}

export const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60_000;

type Listener = (items: OutboxItem[]) => void;
const listeners = new Set<Listener>();
let syncing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  void notify();
  return () => listeners.delete(listener);
}

async function notify() {
  const items = await listOutbox();
  listeners.forEach((l) => l(items));
}

export async function listOutbox(): Promise<OutboxItem[]> {
  try {
    const items = await idb.getAll<OutboxItem>(OUTBOX_STORE);
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export function isSyncing() {
  return syncing;
}

export async function enqueueEntry(input: {
  entry: OutboxItem['entry'];
  customValues: OutboxCustomValue[];
  images: File[];
  voiceNote?: File | null;
  label?: string;
}): Promise<OutboxItem> {
  const toAttachment = (f: File): OutboxAttachment => ({
    name: f.name,
    type: f.type || 'application/octet-stream',
    size: f.size,
    blob: f,
  });

  const item: OutboxItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
    label: input.label || input.entry.notes?.slice(0, 60) || 'Visit log',
    entry: input.entry,
    customValues: input.customValues,
    images: input.images.map(toAttachment),
    voiceNote: input.voiceNote ? toAttachment(input.voiceNote) : null,
    uploadedImageCount: 0,
    voiceUploaded: false,
    customValuesSaved: false,
  };

  await idb.put(OUTBOX_STORE, item);
  await notify();
  scheduleSync(0);
  return item;
}

export async function discardItem(id: string) {
  await idb.delete(OUTBOX_STORE, id);
  await notify();
}

export async function retryItem(id: string) {
  const item = await idb.get<OutboxItem>(OUTBOX_STORE, id);
  if (!item) return;
  item.status = 'pending';
  item.attempts = 0;
  item.nextAttemptAt = 0;
  item.lastError = undefined;
  await idb.put(OUTBOX_STORE, item);
  await notify();
  void syncOutbox();
}

export function scheduleSync(delayMs: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncOutbox();
  }, delayMs);
}

/** Push every deliverable item. Safe to call repeatedly. */
export async function syncOutbox(): Promise<{ sent: number; failed: number }> {
  if (syncing || !navigator.onLine) return { sent: 0, failed: 0 };
  syncing = true;
  let sent = 0;
  let failed = 0;

  try {
    const items = await listOutbox();
    const now = Date.now();
    const due = items.filter((i) => i.status !== 'sending' && i.nextAttemptAt <= now);

    for (const item of due) {
      try {
        item.status = 'sending';
        await idb.put(OUTBOX_STORE, item);
        await notify();

        await deliver(item);

        await idb.delete(OUTBOX_STORE, item.id);
        sent++;
      } catch (err: any) {
        item.attempts += 1;
        item.lastError = err?.message || 'Sync failed';
        item.status = item.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
        item.nextAttemptAt =
          Date.now() + Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (item.attempts - 1));
        await idb.put(OUTBOX_STORE, item);
        failed++;
      }
      await notify();
    }

    // Re-arm for anything still waiting on a backoff window.
    const remaining = await listOutbox();
    const next = remaining
      .filter((i) => i.status === 'pending')
      .map((i) => i.nextAttemptAt - Date.now())
      .sort((a, b) => a - b)[0];
    if (next !== undefined) scheduleSync(Math.max(1_000, next));
  } finally {
    syncing = false;
    await notify();
  }

  return { sent, failed };
}

/** Resumable delivery of one queued entry. */
async function deliver(item: OutboxItem) {
  const tenant = item.entry.admin_id || item.entry.employee_id;

  // 1. Entry row (skipped if a previous attempt already created it)
  if (!item.remoteEntryId) {
    const { data, error } = await supabase
      .from('goods_damaged_entries')
      .insert(item.entry)
      .select('id')
      .single();
    if (error) throw error;
    item.remoteEntryId = data.id;
    await idb.put(OUTBOX_STORE, item);
  }
  const entryId = item.remoteEntryId!;

  // 2. Voice note
  if (item.voiceNote && !item.voiceUploaded) {
    const path = `${tenant}/${entryId}/${Date.now()}-${item.voiceNote.name}`;
    const { data, error } = await supabase.storage
      .from('gd-voice-notes')
      .upload(path, item.voiceNote.blob, { cacheControl: '3600', upsert: false, contentType: item.voiceNote.type });
    if (error) throw error;
    const { data: signed } = await supabase.storage.from('gd-voice-notes').createSignedUrl(data.path, 3600);
    const { error: updErr } = await supabase
      .from('goods_damaged_entries')
      .update({ voice_note_url: signed?.signedUrl || data.path })
      .eq('id', entryId);
    if (updErr) throw updErr;
    item.voiceUploaded = true;
    await idb.put(OUTBOX_STORE, item);
  }

  // 3. Images (resume from the last uploaded index)
  const startIndex = item.uploadedImageCount || 0;
  for (let i = startIndex; i < item.images.length; i++) {
    const img = item.images[i];
    const path = `${tenant}/${entryId}/${Date.now()}-${i}-${img.name}`;
    const { data, error } = await supabase.storage
      .from('gd-entry-images')
      .upload(path, img.blob, { cacheControl: '3600', upsert: false, contentType: img.type });
    if (error) throw error;
    const { data: signed } = await supabase.storage.from('gd-entry-images').createSignedUrl(data.path, 3600);
    const { error: dbErr } = await supabase.from('gd_entry_images').insert({
      gd_entry_id: entryId,
      image_url: signed?.signedUrl || data.path,
      image_name: img.name,
      file_size: img.size,
    });
    if (dbErr) throw dbErr;
    item.uploadedImageCount = i + 1;
    await idb.put(OUTBOX_STORE, item);
  }

  // 4. Custom field values
  if (!item.customValuesSaved && item.customValues.length > 0) {
    const rows = item.customValues.map((cv) => ({ ...cv, gd_entry_id: entryId }));
    const { error } = await (supabase.from('gd_entry_custom_values') as any).insert(rows);
    if (error) throw error;
    item.customValuesSaved = true;
    await idb.put(OUTBOX_STORE, item);
  }
}
