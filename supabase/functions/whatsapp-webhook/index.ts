// deno-lint-ignore-file no-explicit-any
// WhatsApp Cloud API intake: turns staff messages into lost-visit entries.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

const GRAPH = 'https://graph.facebook.com/v20.0';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Meta signs the raw body with the app secret (sha256). */
async function validSignature(raw: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return false;
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function sendText(to: string, body: string) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
  await fetch(`${GRAPH}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: body.slice(0, 3500) } }),
  }).catch(() => undefined);
}

/** Downloads a WhatsApp media object and returns its bytes + mime. */
async function fetchMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!ACCESS_TOKEN) return null;
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  if (!metaRes.ok) return null;
  const meta = await metaRes.json();
  if (!meta?.url) return null;
  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  if (!binRes.ok) return null;
  return { bytes: new Uint8Array(await binRes.arrayBuffer()), mime: meta.mime_type || 'application/octet-stream' };
}

const numbered = (items: { label: string }[]) =>
  items.map((o, i) => `${i + 1}. ${o.label}`).join('\n');

async function setSession(supa: any, phone: string, patch: Record<string, unknown>) {
  await supa.from('wa_sessions').upsert(
    { phone, expires_at: new Date(Date.now() + 30 * 60000).toISOString(), ...patch },
    { onConflict: 'phone' },
  );
}

/** Reason field = first visible dropdown/radio custom field for this tenant. */
async function reasonField(supa: any, adminId: string) {
  const { data } = await supa
    .from('custom_fields')
    .select('id, name, field_type')
    .eq('admin_id', adminId)
    .is('deleted_at', null)
    .eq('is_visible', true)
    .in('field_type', ['dropdown', 'radio'])
    .order('display_order');
  const fields = data || [];
  return fields.find((f: any) => /reason|why|lost/i.test(f.name)) || fields[0] || null;
}

async function createEntry(supa: any, session: any, contact: any) {
  const draft = session.draft || {};
  const entryPayload = {
    shop_id: draft.shop_id ?? null,
    employee_id: contact.profile_id ?? null,
    employee_name: contact.display_name || 'WhatsApp',
    notes: (draft.notes && String(draft.notes).trim()) || 'Voice note attached',
    admin_id: contact.admin_id,
  };

  const { data: entry, error } = await supa
    .from('goods_damaged_entries')
    .insert(entryPayload)
    .select('id')
    .single();
  if (error) throw error;

  if (draft.reason_field_id && draft.reason_option_id) {
    await supa.from('gd_entry_custom_values').insert({
      gd_entry_id: entry.id,
      custom_field_id: draft.reason_field_id,
      custom_field_option_id: draft.reason_option_id,
    });
  }

  // Voice note
  if (draft.audio_id) {
    const media = await fetchMedia(draft.audio_id);
    if (media) {
      const path = `${contact.admin_id}/${entry.id}/${Date.now()}-wa-voice.ogg`;
      const up = await supa.storage.from('gd-voice-notes').upload(path, media.bytes, { contentType: media.mime });
      if (!up.error) {
        const { data: signed } = await supa.storage.from('gd-voice-notes').createSignedUrl(path, 3600);
        await supa.from('goods_damaged_entries').update({ voice_note_url: signed?.signedUrl || path }).eq('id', entry.id);
      }
    }
  }

  // Images
  for (const [i, imgId] of (draft.image_ids || []).slice(0, 3).entries()) {
    const media = await fetchMedia(imgId);
    if (!media) continue;
    const ext = media.mime.includes('png') ? 'png' : 'jpg';
    const path = `${contact.admin_id}/${entry.id}/${Date.now()}-${i}-wa.${ext}`;
    const up = await supa.storage.from('gd-entry-images').upload(path, media.bytes, { contentType: media.mime });
    if (up.error) continue;
    const { data: signed } = await supa.storage.from('gd-entry-images').createSignedUrl(path, 3600);
    await supa.from('gd_entry_images').insert({
      gd_entry_id: entry.id,
      image_url: signed?.signedUrl || path,
      image_name: `whatsapp-${i + 1}.${ext}`,
      file_size: media.bytes.byteLength,
    });
  }

  return entry.id;
}

async function handleMessage(supa: any, msg: any, contactName?: string) {
  const from: string = msg.from;
  const text: string = msg.text?.body?.trim() || msg.button?.text?.trim() || '';

  const { data: contact } = await supa
    .from('wa_contacts')
    .select('*')
    .eq('phone', from)
    .maybeSingle();

  if (!contact) {
    console.log('unregistered whatsapp sender', from, contactName || '');
    await sendText(from, 'This number is not registered for visit logging. Ask your admin to add it in Admin → WhatsApp intake.');
    return;
  }
  if (!contact.is_approved) {
    await sendText(from, 'Your number is pending approval. Ask your admin to approve it in Admin → WhatsApp intake.');
    return;
  }
  await supa.from('wa_contacts').update({ last_message_at: new Date().toISOString() }).eq('id', contact.id);

  if (/^(cancel|stop|reset)$/i.test(text)) {
    await supa.from('wa_sessions').delete().eq('phone', from);
    await sendText(from, 'Cancelled. Send a new message to log another visit.');
    return;
  }

  const { data: existing } = await supa.from('wa_sessions').select('*').eq('phone', from).maybeSingle();
  const fresh = existing && new Date(existing.expires_at).getTime() > Date.now() ? existing : null;
  if (existing && !fresh) await supa.from('wa_sessions').delete().eq('phone', from);

  // --- Step: awaiting shop choice ---
  if (fresh?.step === 'shop') {
    const options = fresh.options || [];
    const pick = Number(text);
    if (!pick || pick < 1 || pick > options.length) {
      await sendText(from, `Please reply with a number:\n${numbered(options)}`);
      return;
    }
    const shop = options[pick - 1];
    const draft = { ...(fresh.draft || {}), shop_id: shop.id, shop_name: shop.label };
    await askReason(supa, from, contact, draft);
    return;
  }

  // --- Step: awaiting reason choice ---
  if (fresh?.step === 'reason') {
    const options = fresh.options || [];
    const pick = Number(text);
    if (!pick || pick < 1 || pick > options.length) {
      await sendText(from, `Please reply with a number:\n${numbered(options)}`);
      return;
    }
    const opt = options[pick - 1];
    const draft = { ...(fresh.draft || {}), reason_option_id: opt.id, reason_label: opt.label };
    try {
      await createEntry(supa, { draft }, contact);
      await supa.from('wa_sessions').delete().eq('phone', from);
      await sendText(
        from,
        `Logged ✅\nShop: ${draft.shop_name || '-'}\nReason: ${opt.label}\nNote: ${draft.notes || '(voice/photo only)'}`,
      );
    } catch (e: any) {
      await sendText(from, `Could not save the visit: ${e.message || 'unknown error'}`);
    }
    return;
  }

  // --- New conversation: capture content, then ask shop ---
  const draft: Record<string, unknown> = { notes: text || '' };
  if (msg.type === 'image' && msg.image?.id) draft.image_ids = [msg.image.id];
  if (msg.image?.caption) draft.notes = msg.image.caption;
  if ((msg.type === 'audio' || msg.type === 'voice') && (msg.audio?.id || msg.voice?.id)) {
    draft.audio_id = msg.audio?.id || msg.voice?.id;
  }
  if (!draft.notes && !draft.image_ids && !draft.audio_id) {
    await sendText(from, 'Send the visit details as text, a photo or a voice note to start logging.');
    return;
  }

  const { data: shops } = await supa
    .from('shops')
    .select('id, name')
    .eq('admin_id', contact.admin_id)
    .is('deleted_at', null)
    .order('name');
  const shopList = (shops || []).map((s: any) => ({ id: s.id, label: s.name }));

  if (shopList.length === 0) {
    await sendText(from, 'No shops are set up yet. Ask your admin to add a shop first.');
    return;
  }
  if (shopList.length === 1) {
    await askReason(supa, from, contact, { ...draft, shop_id: shopList[0].id, shop_name: shopList[0].label });
    return;
  }

  await setSession(supa, from, {
    admin_id: contact.admin_id,
    profile_id: contact.profile_id,
    step: 'shop',
    draft,
    options: shopList,
  });
  await sendText(from, `Which shop?\n${numbered(shopList)}\n\n(Reply with the number, or "cancel")`);
}

async function askReason(supa: any, from: string, contact: any, draft: Record<string, unknown>) {
  const field = await reasonField(supa, contact.admin_id);
  if (!field) {
    try {
      await createEntry(supa, { draft }, contact);
      await supa.from('wa_sessions').delete().eq('phone', from);
      await sendText(from, `Logged ✅\nShop: ${draft.shop_name || '-'}`);
    } catch (e: any) {
      await sendText(from, `Could not save the visit: ${e.message || 'unknown error'}`);
    }
    return;
  }

  const { data: opts } = await supa
    .from('custom_field_options')
    .select('id, value')
    .eq('custom_field_id', field.id)
    .is('deleted_at', null)
    .order('display_order');
  const list = (opts || []).map((o: any) => ({ id: o.id, label: o.value }));

  if (list.length === 0) {
    try {
      await createEntry(supa, { draft }, contact);
      await supa.from('wa_sessions').delete().eq('phone', from);
      await sendText(from, `Logged ✅\nShop: ${draft.shop_name || '-'}`);
    } catch (e: any) {
      await sendText(from, `Could not save the visit: ${e.message || 'unknown error'}`);
    }
    return;
  }

  await setSession(supa, from, {
    admin_id: contact.admin_id,
    profile_id: contact.profile_id,
    step: 'reason',
    draft: { ...draft, reason_field_id: field.id },
    options: list,
  });
  await sendText(from, `${field.name}?\n${numbered(list)}\n\n(Reply with the number, or "cancel")`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);

  // Meta verification handshake
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    if (!VERIFY_TOKEN) return new Response('not configured', { status: 503, headers: corsHeaders });
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get('x-hub-signature-256')))) {
    return json({ error: 'invalid signature' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const profileName = value.contacts?.[0]?.profile?.name;
        for (const msg of value.messages || []) {
          await handleMessage(supa, msg, profileName);
        }
      }
    }
  } catch (e) {
    console.error('whatsapp-webhook error', e);
  }

  // Always 200 so Meta does not retry endlessly.
  return json({ received: true });
});
