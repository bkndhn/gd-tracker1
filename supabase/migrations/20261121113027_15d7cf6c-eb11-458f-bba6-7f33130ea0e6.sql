REVOKE EXECUTE ON FUNCTION public.can_access_team_thread(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_team_thread(uuid, uuid) TO authenticated;
CREATE INDEX IF NOT EXISTS team_messages_shop_idx ON public.team_messages(shop_id);