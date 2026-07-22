
ALTER TABLE public.custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_field_type_check
  CHECK (field_type = ANY (ARRAY['dropdown','radio','text','number','date','textarea','email','phone']));

-- Ensure legacy required columns are nullable so form can stop populating them
ALTER TABLE public.goods_damaged_entries ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE public.goods_damaged_entries ALTER COLUMN size_id DROP NOT NULL;
ALTER TABLE public.goods_damaged_entries ALTER COLUMN customer_type_id DROP NOT NULL;
