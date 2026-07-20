
-- Phase 2A: Seed standard fields into custom_fields (safe, reversible)

-- 1. Schema additions
ALTER TABLE public.custom_fields
  ADD COLUMN IF NOT EXISTS is_standard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS standard_key text;

ALTER TABLE public.custom_field_options
  ADD COLUMN IF NOT EXISTS legacy_id uuid,
  ADD COLUMN IF NOT EXISTS legacy_table text;

CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_admin_standard_key_uniq
  ON public.custom_fields(admin_id, standard_key)
  WHERE standard_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS custom_field_options_legacy_idx
  ON public.custom_field_options(legacy_table, legacy_id)
  WHERE legacy_id IS NOT NULL;

-- 2. Seed 4 standard custom_fields per admin
WITH admins AS (
  SELECT DISTINCT id AS admin_id FROM public.profiles
  WHERE role IN ('admin','super_admin') AND deleted_at IS NULL
),
seeds(standard_key, name, field_type, display_order) AS (
  VALUES
    ('shop','Shop','dropdown',-40),
    ('category','Category','dropdown',-30),
    ('size','Size','dropdown',-20),
    ('customer_type','Customer Type','dropdown',-10)
)
INSERT INTO public.custom_fields (admin_id, name, field_type, is_visible, is_mandatory, display_order, is_standard, standard_key)
SELECT a.admin_id, s.name, s.field_type, true, true, s.display_order, true, s.standard_key
FROM admins a CROSS JOIN seeds s
ON CONFLICT DO NOTHING;

-- 3. Copy lookup rows into custom_field_options with legacy_id back-pointer
INSERT INTO public.custom_field_options (custom_field_id, value, display_order, legacy_id, legacy_table)
SELECT cf.id, sh.name, 0, sh.id, 'shops'
FROM public.shops sh
JOIN public.custom_fields cf
  ON cf.admin_id = sh.admin_id AND cf.standard_key = 'shop' AND cf.deleted_at IS NULL
WHERE sh.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.custom_field_options o
    WHERE o.legacy_table = 'shops' AND o.legacy_id = sh.id
  );

INSERT INTO public.custom_field_options (custom_field_id, value, display_order, legacy_id, legacy_table)
SELECT cf.id, c.name, 0, c.id, 'categories'
FROM public.categories c
JOIN public.custom_fields cf
  ON cf.admin_id = c.admin_id AND cf.standard_key = 'category' AND cf.deleted_at IS NULL
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.custom_field_options o
    WHERE o.legacy_table = 'categories' AND o.legacy_id = c.id
  );

INSERT INTO public.custom_field_options (custom_field_id, value, display_order, legacy_id, legacy_table)
SELECT cf.id, sz.size, 0, sz.id, 'sizes'
FROM public.sizes sz
JOIN public.custom_fields cf
  ON cf.admin_id = sz.admin_id AND cf.standard_key = 'size' AND cf.deleted_at IS NULL
WHERE sz.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.custom_field_options o
    WHERE o.legacy_table = 'sizes' AND o.legacy_id = sz.id
  );

INSERT INTO public.custom_field_options (custom_field_id, value, display_order, legacy_id, legacy_table)
SELECT cf.id, ct.name, 0, ct.id, 'customer_types'
FROM public.customer_types ct
JOIN public.custom_fields cf
  ON cf.admin_id = ct.admin_id AND cf.standard_key = 'customer_type' AND cf.deleted_at IS NULL
WHERE ct.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.custom_field_options o
    WHERE o.legacy_table = 'customer_types' AND o.legacy_id = ct.id
  );
