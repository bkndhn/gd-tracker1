-- Migration: Client-isolated theme and custom field quota safeguards
-- Date: 2026-09-17

-- 1. Add quota columns and client theme color to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_fields_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_custom_fields integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_options_per_field integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT 'purple';

-- 2. Update the privilege escalation trigger function
-- Guard privileged quota columns while allowing client admins to update their own theme_color
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
BEGIN
  caller_role := public.get_user_role_secure(auth.uid());
  
  -- Non-admins cannot alter privileged user fields
  IF caller_role IS DISTINCT FROM 'super_admin' AND caller_role IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.admin_id IS DISTINCT FROM OLD.admin_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.max_users IS DISTINCT FROM OLD.max_users
       OR NEW.max_shops IS DISTINCT FROM OLD.max_shops
       OR NEW.max_entries IS DISTINCT FROM OLD.max_entries
       OR NEW.max_images_per_entry IS DISTINCT FROM OLD.max_images_per_entry
       OR NEW.max_images_total IS DISTINCT FROM OLD.max_images_total
       OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
       OR NEW.warehouse_shop_ids IS DISTINCT FROM OLD.warehouse_shop_ids
       OR NEW.warehouse_all_shops IS DISTINCT FROM OLD.warehouse_all_shops
       OR NEW.custom_fields_enabled IS DISTINCT FROM OLD.custom_fields_enabled
       OR NEW.max_custom_fields IS DISTINCT FROM OLD.max_custom_fields
       OR NEW.max_options_per_field IS DISTINCT FROM OLD.max_options_per_field
    THEN
      RAISE EXCEPTION 'Not allowed to change privileged fields';
    END IF;
  END IF;

  -- Only super_admin can alter tenant limits & assign super_admin role
  IF caller_role IS DISTINCT FROM 'super_admin' THEN
    IF NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Only super_admin can grant super_admin';
    END IF;
    IF NEW.requirements_enabled IS DISTINCT FROM OLD.requirements_enabled
       OR NEW.max_requirements_monthly IS DISTINCT FROM OLD.max_requirements_monthly
       OR NEW.max_warehouse_users IS DISTINCT FROM OLD.max_warehouse_users
       OR NEW.custom_fields_enabled IS DISTINCT FROM OLD.custom_fields_enabled
       OR NEW.max_custom_fields IS DISTINCT FROM OLD.max_custom_fields
       OR NEW.max_options_per_field IS DISTINCT FROM OLD.max_options_per_field
    THEN
      RAISE EXCEPTION 'Only super_admin can change plan limits';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
