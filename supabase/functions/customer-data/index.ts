import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  action: z.enum(['export', 'anonymize']),
  phone: z.string().min(8).max(20).regex(/^[0-9+\-\s]+$/),
});

/** GDPR-style per-customer data export and anonymization, tenant-scoped to the caller. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate caller JWT
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await anon.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: caller } = await supabase
      .from('profiles')
      .select('id, role, admin_id, status')
      .eq('id', user.id)
      .is('deleted_at', null)
      .single();
    if (!caller || caller.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (caller.role !== 'admin' && caller.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Admins only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminId = caller.role === 'admin' ? caller.id : caller.admin_id || caller.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { action, phone } = parsed.data;
    const digits = phone.replace(/\D/g, '');
    const last10 = digits.slice(-10);

    // Follow-ups for this phone within the tenant
    const { data: followUps } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('admin_id', adminId)
      .ilike('phone', `%${last10}`)
      .order('sent_at', { ascending: false });

    // Contact record
    const { data: contacts } = await supabase
      .from('wa_contacts')
      .select('*')
      .eq('admin_id', adminId)
      .ilike('phone', `%${last10}`);

    // Entries whose custom-field values contain the phone (phone stored as a text custom field)
    const { data: matchingValues } = await supabase
      .from('gd_entry_custom_values')
      .select('gd_entry_id, value')
      .ilike('value', `%${last10}`);
    const entryIds = Array.from(new Set((matchingValues || []).map((v: any) => v.gd_entry_id).filter(Boolean)));

    let entries: any[] = [];
    if (entryIds.length) {
      const { data } = await supabase
        .from('goods_damaged_entries')
        .select('id, created_at, employee_name, notes, shop_id')
        .eq('admin_id', adminId)
        .in('id', entryIds);
      entries = data || [];
    }

    if (action === 'export') {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'settings_changed',
        target_type: 'customer_data_export',
        details: { phone_last4: last10.slice(-4), follow_ups: followUps?.length || 0, entries: entries.length },
      });
      return new Response(JSON.stringify({
        phone_masked: `******${last10.slice(-4)}`,
        exported_at: new Date().toISOString(),
        contact: contacts?.[0] || null,
        follow_ups: followUps || [],
        entries,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // anonymize: mask phone + name everywhere for this tenant
    const masked = `ANON-${last10.slice(-4)}`;
    let updated = 0;
    if (followUps?.length) {
      const { count } = await supabase
        .from('follow_ups')
        .update({ phone: masked, customer_name: null, message: null, outcome_note: null }, { count: 'exact' })
        .eq('admin_id', adminId)
        .ilike('phone', `%${last10}`);
      updated += count || 0;
    }
    if (contacts?.length) {
      const { count } = await supabase
        .from('wa_contacts')
        .update({ phone: masked, display_name: null }, { count: 'exact' })
        .eq('admin_id', adminId)
        .ilike('phone', `%${last10}`);
      updated += count || 0;
    }
    if (matchingValues?.length) {
      const ids = matchingValues.map((v: any) => v.gd_entry_id).filter(Boolean);
      if (ids.length) {
        const { count } = await supabase
          .from('gd_entry_custom_values')
          .update({ value: masked }, { count: 'exact' })
          .ilike('value', `%${last10}`);
        updated += count || 0;
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'settings_changed',
      target_type: 'customer_data_anonymize',
      details: { phone_last4: last10.slice(-4), records_updated: updated },
    });

    return new Response(JSON.stringify({ ok: true, records_updated: updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
