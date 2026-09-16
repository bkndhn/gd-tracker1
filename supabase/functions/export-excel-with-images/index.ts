import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ExcelJS from 'npm:exceljs@4.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EntryImage {
  id: string;
  image_url: string;
  image_name?: string;
}

interface GoodsEntry {
  id: string;
  created_at: string;
  shop_id: string;
  category_id: string;
  size_id: string;
  employee_name: string;
  notes: string;
  customer_type_id?: string;
  admin_id?: string;
  shops: { name: string };
  categories: { name: string };
  sizes: { size: string };
  customer_types?: { name: string };
  gd_entry_images: EntryImage[];
}

/**
 * Only images hosted on this project's own Supabase storage may be fetched.
 * Prevents the export from being used as an SSRF proxy to arbitrary hosts.
 */
function isAllowedImageUrl(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== 'https:') return false;
    const base = new URL(Deno.env.get('SUPABASE_URL')!);
    return url.hostname === base.hostname && url.pathname.startsWith('/storage/v1/');
  } catch {
    return false;
  }
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; extension: 'jpeg' | 'png' | 'gif' } | null> {
  try {
    if (!isAllowedImageUrl(imageUrl)) {
      console.warn('Blocked non-storage image URL in export');
      return null;
    }
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const contentType = response.headers.get('content-type') || '';
    let extension: 'jpeg' | 'png' | 'gif' = 'jpeg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('gif')) extension = 'gif';
    return { base64, extension };
  } catch (error) {
    console.error('Error fetching image:', imageUrl, error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AUTH CHECK ---
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

    // Check role - only admin, manager, or super_admin can export
    const { data: callerProfile } = await supabaseAuth
      .from('profiles')
      .select('role, admin_id, status')
      .eq('id', userId)
      .single();

    if (!callerProfile || !['admin', 'manager', 'super_admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the caller's authenticated client for tenant-scoped queries (RLS enforced)
    const body = await req.json().catch(() => ({}));
    const providedEntries = body.entries as GoodsEntry[] | undefined;

    let enrichedEntries: GoodsEntry[];

    if (providedEntries && providedEntries.length > 0) {
      enrichedEntries = providedEntries;
    } else {
      // Fetch using the AUTHENTICATED client so RLS filters by tenant
      let query = supabaseAuth
        .from('goods_damaged_entries')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: entriesData, error: entriesError } = await query;
      if (entriesError) throw entriesError;

      const entryIds = (entriesData || []).map((e: any) => e.id);
      const { data: imagesData } = entryIds.length > 0
        ? await supabaseAuth.from('gd_entry_images').select('*').in('gd_entry_id', entryIds)
        : { data: [] };

      const [shopsRes, categoriesRes, sizesRes, customerTypesRes] = await Promise.all([
        supabaseAuth.from('shops').select('*'),
        supabaseAuth.from('categories').select('*'),
        supabaseAuth.from('sizes').select('*'),
        supabaseAuth.from('customer_types').select('*'),
      ]);

      enrichedEntries = (entriesData || []).map((entry: any) => {
        const shop = shopsRes.data?.find((s: any) => s.id === entry.shop_id);
        const category = categoriesRes.data?.find((c: any) => c.id === entry.category_id);
        const size = sizesRes.data?.find((s: any) => s.id === entry.size_id);
        const customerType = customerTypesRes.data?.find((ct: any) => ct.id === entry.customer_type_id);
        const entryImages = (imagesData || []).filter((img: any) => img.gd_entry_id === entry.id);
        return {
          ...entry,
          shops: { name: shop?.name || 'Unknown Shop' },
          categories: { name: category?.name || 'Unknown Category' },
          sizes: { size: size?.size || 'Unknown Size' },
          customer_types: customerType ? { name: customerType.name } : undefined,
          gd_entry_images: entryImages,
        };
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GD Tracker App';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('GD Report', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Date & Time', key: 'date', width: 20 },
      { header: 'Shop', key: 'shop', width: 18 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Customer Type', key: 'customerType', width: 18 },
      { header: 'Reporter', key: 'reporter', width: 18 },
      { header: 'Notes', key: 'notes', width: 35 },
      { header: 'Image 1', key: 'image1', width: 18 },
      { header: 'Image 2', key: 'image2', width: 18 },
      { header: 'Image 3', key: 'image3', width: 18 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    let rowIndex = 2;
    for (let i = 0; i < enrichedEntries.length; i++) {
      const entry = enrichedEntries[i];
      const date = new Date(entry.created_at);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear().toString().slice(-2)} ${date.getHours() % 12 || 12}:${date.getMinutes().toString().padStart(2, '0')} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;

      const row = worksheet.addRow({
        sno: i + 1,
        date: formattedDate,
        shop: entry.shops?.name || 'Unknown',
        category: entry.categories?.name || 'Unknown',
        size: entry.sizes?.size || 'Unknown',
        customerType: entry.customer_types?.name || 'N/A',
        reporter: entry.employee_name || 'Unknown',
        notes: entry.notes || '',
        image1: '', image2: '', image3: '',
      });

      row.height = 80;
      row.alignment = { vertical: 'middle', wrapText: true };

      const images = entry.gd_entry_images?.slice(0, 3) || [];
      for (let imgIndex = 0; imgIndex < images.length; imgIndex++) {
        try {
          const imageData = await fetchImageAsBase64(images[imgIndex].image_url);
          if (imageData) {
            const imageId = workbook.addImage({ base64: imageData.base64, extension: imageData.extension });
            worksheet.addImage(imageId, { tl: { col: 8 + imgIndex, row: rowIndex - 1 }, ext: { width: 100, height: 75 } });
          }
        } catch (imgError) {
          console.error(`Error adding image for entry ${entry.id}:`, imgError);
        }
      }
      rowIndex++;
    }

    for (let i = 2; i <= rowIndex; i++) {
      const row = worksheet.getRow(i);
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    }

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="gd_report_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
