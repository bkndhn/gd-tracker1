-- Phase 2D: Backfill gd_entry_custom_values from legacy FK columns.
-- Safe to re-run; ON CONFLICT DO NOTHING guarded by NOT EXISTS.

WITH std AS (
  SELECT cf.id AS field_id, cf.admin_id, cf.standard_key
  FROM public.custom_fields cf
  WHERE cf.is_standard = true
    AND cf.deleted_at IS NULL
),
opts AS (
  SELECT cfo.id AS option_id, cfo.custom_field_id, cfo.legacy_id
  FROM public.custom_field_options cfo
  WHERE cfo.deleted_at IS NULL
    AND cfo.legacy_id IS NOT NULL
)
INSERT INTO public.gd_entry_custom_values (gd_entry_id, custom_field_id, custom_field_option_id)
SELECT ge.id, std.field_id, opts.option_id
FROM public.goods_damaged_entries ge
JOIN std ON std.admin_id = ge.admin_id
JOIN opts ON opts.custom_field_id = std.field_id
  AND opts.legacy_id = CASE std.standard_key
    WHEN 'shop' THEN ge.shop_id
    WHEN 'category' THEN ge.category_id
    WHEN 'size' THEN ge.size_id
    WHEN 'customer_type' THEN ge.customer_type_id
  END
WHERE NOT EXISTS (
  SELECT 1 FROM public.gd_entry_custom_values existing
  WHERE existing.gd_entry_id = ge.id
    AND existing.custom_field_id = std.field_id
);