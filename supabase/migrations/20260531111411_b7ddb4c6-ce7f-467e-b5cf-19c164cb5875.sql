-- Wipe operational data, keep users/profiles/app_settings
TRUNCATE TABLE 
  public.gd_entry_custom_values,
  public.gd_entry_images,
  public.goods_damaged_entries,
  public.custom_field_options,
  public.custom_fields,
  public.customer_types,
  public.sizes,
  public.categories,
  public.shops
RESTART IDENTITY CASCADE;