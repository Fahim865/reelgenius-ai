CREATE TABLE public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  body text NOT NULL,
  niche text,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_templates TO authenticated;
GRANT ALL ON public.prompt_templates TO service_role;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates are readable by everyone signed in" ON public.prompt_templates FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "templates insert own" ON public.prompt_templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "templates update own" ON public.prompt_templates FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "templates delete own" ON public.prompt_templates FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO public.prompt_templates (user_id, name, body, niche, is_builtin) VALUES
(NULL, 'Bold claim hook (Hormozi style)', 'Open with a bold, slightly controversial claim about {topic} in the first 5 seconds. Then reveal the hidden cost of ignoring it. Then give 3 fast, concrete steps. Close with: comment the keyword "{keyword}" and I will send the full checklist.', NULL, true),
(NULL, 'Myth buster', 'Open with: "Everything you know about {topic} is wrong." Show the myth everyone believes, then the truth with one surprising number. Give the correct 2-step method. Close with: follow for the part everyone gets wrong next.', NULL, true),
(NULL, '3 mistakes listicle', 'Open with: "If you keep failing at {topic}, you are making one of these 3 mistakes." Count down mistake 3 to mistake 1, each with a one-line fix. Close with: save this so you never repeat mistake 1.', NULL, true),
(NULL, 'Before / after transformation', 'Open with the after-state: what life looks like once {topic} is solved. Flash back to the before-state pain. Show the single turning point and the 3 steps from there to here. Close with: comment "START" and I will send the roadmap.', NULL, true),
(NULL, 'Story time', 'Open mid-action: "Last week {topic} almost cost me everything." Tell the story in 6 fast beats, each beat a new visual. Land the lesson in one sentence. Close with: follow, tomorrow I tell you what happened next.', NULL, true),
(NULL, 'Trend take (newsjacking)', 'Open with: "Stop scrolling — {trend} just changed {topic} forever." Explain what happened in one line, why most people will miss it, and the one move to make this week. Close with: comment "TREND" for my full breakdown.', NULL, true);

CREATE TABLE public.ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'other',
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_user_created_idx ON public.ai_usage (user_id, created_at);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai usage read own" ON public.ai_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ai usage insert own" ON public.ai_usage FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  provider text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions read own" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "subscriptions insert own" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "subscriptions update own" ON public.subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());