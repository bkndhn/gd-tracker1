import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet } from '@/lib/offlineDb';

const CV_INDEX_CACHE_KEY = 'custom-value-index';

export type StandardKey = 'shop' | 'category' | 'size' | 'customer_type';

export interface CustomFieldDef {
  id: string;
  name: string;
  is_visible: boolean;
  is_mandatory: boolean;
  display_order: number;
  field_type?: string | null;
  is_standard?: boolean | null;
  standard_key?: string | null;
}

export interface CustomFieldOptionDef {
  id: string;
  custom_field_id: string;
  value: string;
  display_order?: number | null;
}

export interface CustomValueIndex {
  /** All non-deleted custom fields for the tenant (RLS scoped), ordered by display_order */
  fields: CustomFieldDef[];
  /** Only fields flagged visible — what the UI should render as columns */
  visibleFields: CustomFieldDef[];
  optionsByField: Record<string, CustomFieldOptionDef[]>;
  standardFieldByKey: Partial<Record<StandardKey, CustomFieldDef>>;
  /** entryId -> fieldId -> display text */
  valuesByEntry: Record<string, Record<string, string>>;
}

export const EMPTY_INDEX: CustomValueIndex = {
  fields: [],
  visibleFields: [],
  optionsByField: {},
  standardFieldByKey: {},
  valuesByEntry: {},
};

const PAGE = 1000;

async function fetchValues(entryIds: string[], fieldIds: string[]) {
  const out: any[] = [];
  for (let i = 0; i < entryIds.length; i += 200) {
    const chunk = entryIds.slice(i, i + 200);
    let from = 0;
    // paginate: Supabase caps at 1000 rows per request
    for (;;) {
      const { data, error } = await (supabase.from('gd_entry_custom_values') as any)
        .select('gd_entry_id, custom_field_id, custom_field_option_id, value')
        .in('gd_entry_id', chunk)
        .in('custom_field_id', fieldIds)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
  }
  return out;
}

/**
 * Builds the single source of truth for entry field values: everything is read
 * from `gd_entry_custom_values` (no legacy category/size/customer_type joins).
 */
export async function fetchCustomValueIndex(entryIds: string[], adminId?: string | null): Promise<CustomValueIndex> {
  let fieldsQuery = (supabase.from('custom_fields') as any)
    .select('id, name, is_visible, is_mandatory, display_order, field_type, is_standard, standard_key')
    .or('scope.eq.visit,scope.is.null')
    .is('deleted_at', null)
    .order('display_order');

  if (adminId) {
    fieldsQuery = fieldsQuery.eq('admin_id', adminId);
  }

  const fieldsRes = await fieldsQuery;

  if (fieldsRes.error) throw fieldsRes.error;
  const fields: CustomFieldDef[] = fieldsRes.data || [];
  if (fields.length === 0) return EMPTY_INDEX;

  const fieldIds = fields.map(f => f.id);

  const optionsRes = await (supabase.from('custom_field_options') as any)
    .select('id, custom_field_id, value, display_order')
    .in('custom_field_id', fieldIds)
    .is('deleted_at', null)
    .order('display_order');
  if (optionsRes.error) throw optionsRes.error;

  const optionsByField: Record<string, CustomFieldOptionDef[]> = {};
  const optionTextById: Record<string, string> = {};
  (optionsRes.data || []).forEach((opt: CustomFieldOptionDef) => {
    optionTextById[opt.id] = opt.value;
    (optionsByField[opt.custom_field_id] ||= []).push(opt);
  });

  const standardFieldByKey: Partial<Record<StandardKey, CustomFieldDef>> = {};
  fields.forEach(f => {
    if (f.is_standard && f.standard_key) {
      standardFieldByKey[f.standard_key as StandardKey] = f;
    }
  });

  const valuesByEntry: Record<string, Record<string, string>> = {};
  if (entryIds.length > 0) {
    const rows = await fetchValues(entryIds, fieldIds);
    rows.forEach((row: any) => {
      const text = row.custom_field_option_id
        ? optionTextById[row.custom_field_option_id]
        : row.value;
      if (text === undefined || text === null || text === '') return;
      (valuesByEntry[row.gd_entry_id] ||= {})[row.custom_field_id] = String(text);
    });
  }

  return {
    fields,
    visibleFields: fields.filter(f => f.is_visible),
    optionsByField,
    standardFieldByKey,
    valuesByEntry,
  };
}

/** Reads a standard field's display text for an entry, e.g. stdValue(idx, id, 'category') */
export function stdValue(
  index: CustomValueIndex | undefined,
  entryId: string,
  key: StandardKey,
): string | undefined {
  if (!index) return undefined;
  const field = index.standardFieldByKey[key];
  if (!field) return undefined;
  return index.valuesByEntry[entryId]?.[field.id];
}

/** Distinct option values available for a standard field (drives filter dropdowns) */
export function stdOptions(index: CustomValueIndex | undefined, key: StandardKey): string[] {
  if (!index) return [];
  const field = index.standardFieldByKey[key];
  if (!field) return [];
  return (index.optionsByField[field.id] || []).map(o => o.value);
}

export function useCustomValueIndex(entryIds: string[], enabled = true, adminId?: string | null) {
  const key = entryIds.length ? `${entryIds.length}:${entryIds[0]}:${entryIds[entryIds.length - 1]}:${adminId || 'all'}` : `none:${adminId || 'all'}`;
  const cacheKey = `${CV_INDEX_CACHE_KEY}_${adminId || 'all'}`;
  return useQuery({
    queryKey: ['custom-value-index', key],
    queryFn: async () => {
      // Offline / failed fetch: fall back to the last good index so labels still render
      if (!navigator.onLine) {
        const cached = await cacheGet<CustomValueIndex>(cacheKey);
        if (cached) return cached.value;
      }
      try {
        const index = await fetchCustomValueIndex(entryIds, adminId);
        void cacheSet(cacheKey, index);
        return index;
      } catch (err) {
        const cached = await cacheGet<CustomValueIndex>(cacheKey);
        if (cached) return cached.value;
        throw err;
      }
    },
    enabled,
    staleTime: 1000 * 60,
  });
}
