DROP POLICY IF EXISTS "client_errors_insert_anyone" ON public.client_errors;

CREATE POLICY "client_errors_insert_self"
  ON public.client_errors FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NOT DISTINCT FROM auth.uid()
    AND length(message) <= 2000
    AND (stack IS NULL OR length(stack) <= 8000)
    AND (component_stack IS NULL OR length(component_stack) <= 8000)
    AND (url IS NULL OR length(url) <= 1000)
    AND (user_agent IS NULL OR length(user_agent) <= 500)
    AND level IN ('error', 'warn', 'fatal')
  );