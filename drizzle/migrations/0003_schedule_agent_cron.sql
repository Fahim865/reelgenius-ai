create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
grant all on public.app_config to service_role;

do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname in ('reelpilot-agent-tick','reelpilot-metrics-sweep') loop
    perform cron.unschedule(j.jobname);
  end loop;
end $$;

select cron.schedule(
  'reelpilot-agent-tick',
  '0 */6 * * *',
  $job$
  select net.http_post(
    url := 'https://project--4097f882-ebff-4b04-9863-966e5fa8db49.lovable.app/api/public/hooks/agent-tick',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', (select value from public.app_config where key = 'cron_secret')),
    body := '{}'::jsonb
  );
  $job$
);

select cron.schedule(
  'reelpilot-metrics-sweep',
  '30 */4 * * *',
  $job$
  select net.http_post(
    url := 'https://project--4097f882-ebff-4b04-9863-966e5fa8db49.lovable.app/api/public/hooks/metrics-sweep',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', (select value from public.app_config where key = 'cron_secret')),
    body := '{}'::jsonb
  );
  $job$
);