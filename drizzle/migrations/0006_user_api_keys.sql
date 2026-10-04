CREATE TABLE public.user_api_keys (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','META_APP_ID','META_APP_SECRET','PEXELS_API_KEY','YOUTUBE_API_KEY','JAMENDO_CLIENT_ID')),
  value text NOT NULL CHECK (length(value) BETWEEN 4 AND 4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, name)
);
GRANT INSERT, UPDATE, DELETE ON public.user_api_keys TO authenticated;
GRANT SELECT (user_id, name, updated_at) ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own keys" ON public.user_api_keys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);