-- Add must_change_password, is_temp_password and limit columns to profiles for multi-tenant isolation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_entries INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_images_per_entry INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_images_total INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_daily_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_monthly_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_lifetime_limit INTEGER DEFAULT NULL;
