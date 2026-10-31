import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const escHtml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

interface AlertRequest {
  shopId?: string;
  checkPeriod?: 'daily' | 'weekly';
  threshold?: number;
  recipientEmail?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AUTH CHECK: require admin or super_admin ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { data: callerProfile } = await supabaseAuth
      .from('profiles')
      .select('role, admin_id')
      .eq('id', userId)
      .single();

    if (!callerProfile || !['admin', 'super_admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Only admins can trigger alerts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ message: 'Email alerts not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);
    
    // Use authenticated client for tenant-scoped data
    const { shopId, checkPeriod = 'daily', threshold = 10, recipientEmail }: AlertRequest = await req.json();

    const now = new Date();
    const startDate = new Date();
    if (checkPeriod === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    }

    // Query through authenticated client - RLS enforces tenant isolation
    let query = supabaseAuth
      .from('goods_damaged_entries')
      .select('id, shop_id, created_at', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    const { data: entries, count, error: entriesError } = await query;
    if (entriesError) throw entriesError;

    const shopCounts: Record<string, { count: number; name: string }> = {};
    if (entries) {
      const shopIds = [...new Set(entries.map((e: any) => e.shop_id))];
      const { data: shops } = await supabaseAuth.from('shops').select('id, name').in('id', shopIds);
      const shopNameMap = new Map(shops?.map((s: any) => [s.id, s.name]) || []);

      for (const entry of entries) {
        if (!shopCounts[entry.shop_id]) {
          shopCounts[entry.shop_id] = { count: 0, name: shopNameMap.get(entry.shop_id) || 'Unknown Shop' };
        }
        shopCounts[entry.shop_id].count++;
      }
    }

    const alertShops = Object.entries(shopCounts)
      .filter(([_, data]) => data.count >= threshold)
      .map(([id, data]) => ({ shopId: id, shopName: data.name, count: data.count }));

    if (alertShops.length === 0) {
      return new Response(JSON.stringify({ message: 'No alerts needed', totalEntries: count, threshold, period: checkPeriod }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine recipients - use caller's email or provided one
    // Alerts always go to the calling admin only; a recipientEmail is accepted
    // only when it matches the caller's own address.
    let emailRecipients: string[] = [];
    const { data: callerFull } = await supabaseAuth.from('profiles').select('email').eq('id', userId).single();
    const ownEmail = String(callerFull?.email || '').trim().toLowerCase();
    if (ownEmail && (!recipientEmail || String(recipientEmail).trim().toLowerCase() === ownEmail)) {
      emailRecipients = [ownEmail];
    }

    if (emailRecipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No email recipients configured', alertShops }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const periodText = checkPeriod === 'daily' ? 'today' : 'this week';
    const shopAlertRows = alertShops
      .map(s => `<tr><td style="padding: 10px; border: 1px solid #ddd;">${escHtml(s.shopName)}</td><td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #dc2626; font-weight: bold;">${s.count}</td></tr>`)
      .join('');

    const emailHtml = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">⚠️ GD Alert - Threshold Exceeded</h1>
      </div>
      <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
        <p>The following shops exceeded <strong>${escHtml(threshold)} GD entries</strong> ${periodText}:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead><tr style="background: #f3f4f6;"><th style="padding: 12px; border: 1px solid #ddd;">Shop</th><th style="padding: 12px; border: 1px solid #ddd;">Count</th></tr></thead>
          <tbody>${shopAlertRows}</tbody>
        </table>
      </div></body></html>`;

    await resend.emails.send({
      from: 'GD Tracker <onboarding@resend.dev>',
      to: emailRecipients,
      subject: `⚠️ GD Alert: ${alertShops.length} shop(s) exceeded threshold ${periodText}`,
      html: emailHtml,
    });

    return new Response(JSON.stringify({ success: true, alertsSent: alertShops.length, recipients: emailRecipients.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in send-gd-alert:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
