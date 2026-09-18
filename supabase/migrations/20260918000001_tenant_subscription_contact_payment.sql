-- Add contact phone, subscription amount, plan visibility, and UPI payment settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_amount NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS show_plan_to_client BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_payment_ref TEXT DEFAULT NULL;
