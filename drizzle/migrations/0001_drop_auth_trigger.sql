DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.profiles (id, email)
  SELECT uid, (SELECT email FROM auth.users WHERE id = uid)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.agent_settings (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.insights (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_user_bootstrap() TO authenticated;