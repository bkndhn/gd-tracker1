import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const escHtml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
      .select('role, email')
      .eq('id', userId)
      .single();

    if (!callerProfile || !['admin', 'super_admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Only admins can check thresholds' }), {
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

    const DAILY_THRESHOLD = 10;
    const WEEKLY_THRESHOLD = 50;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Use authenticated client - RLS enforces tenant isolation
    const [dailyRes, weeklyRes] = await Promise.all([
      supabaseAuth.from('goods_damaged_entries').select('shop_id').gte('created_at', today.toISOString()),
      supabaseAuth.from('goods_damaged_entries').select('shop_id').gte('created_at', weekStart.toISOString()),
    ]);

    if (dailyRes.error) throw dailyRes.error;
    if (weeklyRes.error) throw weeklyRes.error;

    const dailyCounts: Record<string, number> = {};
    const weeklyCounts: Record<string, number> = {};
    dailyRes.data?.forEach((e: any) => { dailyCounts[e.shop_id] = (dailyCounts[e.shop_id] || 0) + 1; });
    weeklyRes.data?.forEach((e: any) => { weeklyCounts[e.shop_id] = (weeklyCounts[e.shop_id] || 0) + 1; });

    const allShopIds = [...new Set([...Object.keys(dailyCounts), ...Object.keys(weeklyCounts)])];
    if (allShopIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No entries to check' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: shops } = await supabaseAuth.from('shops').select('id, name').in('id', allShopIds);
    const shopNameMap = new Map(shops?.map((s: any) => [s.id, s.name]) || []);

    const dailyAlerts = Object.entries(dailyCounts)
      .filter(([_, count]) => count >= DAILY_THRESHOLD)
      .map(([shopId, count]) => ({ shopName: shopNameMap.get(shopId) || 'Unknown', count, type: 'daily' as const }));

    const weeklyAlerts = Object.entries(weeklyCounts)
      .filter(([_, count]) => count >= WEEKLY_THRESHOLD)
      .map(([shopId, count]) => ({ shopName: shopNameMap.get(shopId) || 'Unknown', count, type: 'weekly' as const }));

    const allAlerts = [...dailyAlerts, ...weeklyAlerts];

    if (allAlerts.length === 0) {
      return new Response(JSON.stringify({ message: 'No alerts needed', dailyThreshold: DAILY_THRESHOLD, weeklyThreshold: WEEKLY_THRESHOLD }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only send to the calling admin's email
    const adminEmail = callerProfile.email;
    if (!adminEmail) {
      return new Response(JSON.stringify({ message: 'No admin email found', alerts: allAlerts }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const alertRows = allAlerts
      .map(a => `<tr><td style="padding: 10px; border: 1px solid #ddd;">${escHtml(a.shopName)}</td><td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #dc2626; font-weight: bold;">${a.count}</td><td style="padding: 10px; border: 1px solid #ddd;">${a.type === 'daily' ? 'Daily' : 'Weekly'}</td></tr>`)
      .join('');

    const emailHtml = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #f87171 100%); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🚨 GD Threshold Alert</h1>
      </div>
      <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
        <p>The following shops exceeded thresholds:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead><tr style="background: #f3f4f6;"><th style="padding: 12px; border: 1px solid #ddd;">Shop</th><th style="padding: 12px; border: 1px solid #ddd;">Count</th><th style="padding: 12px; border: 1px solid #ddd;">Period</th></tr></thead>
          <tbody>${alertRows}</tbody>
        </table>
        <p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <strong>Thresholds:</strong> Daily: ${DAILY_THRESHOLD} | Weekly: ${WEEKLY_THRESHOLD}
        </p>
      </div></body></html>`;

    await resend.emails.send({
      from: 'GD Tracker <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `🚨 GD Alert: ${allAlerts.length} threshold(s) exceeded`,
      html: emailHtml,
    });

    return new Response(JSON.stringify({ success: true, alertsSent: allAlerts.length, recipients: 1 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
