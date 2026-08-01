GRANT EXECUTE ON FUNCTION public.get_user_admin_id_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_shop_id_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;