-- Sends the one permitted additional weekly-summary test to WatchEcommerceDemo.
-- Requires the resend migration, the latest send-weekly-summary deployment,
-- and existing weekly-summary Vault secrets. This does not touch the normal
-- queue. A generated request key makes transport retries fail closed.
do $$
declare matches integer; prior_count integer; prior_status text;
begin
  if not exists(select 1 from vault.secrets where name='weekly_summary_cron_secret')
     or not exists(select 1 from vault.secrets where name='weekly_summary_function_url') then
    raise exception 'Create both weekly summary secrets in Vault before requesting the test';
  end if;
  select count(*)::integer into matches from public.companies where name='WatchEcommerceDemo';
  if matches<>1 then raise exception 'Expected exactly one WatchEcommerceDemo company'; end if;
  select count(*)::integer,max(t.status) into prior_count,prior_status
  from public.company_weekly_summary_watch_test t join public.companies c on c.id=t.company_id
  where c.name='WatchEcommerceDemo';
  if prior_count<>1 or prior_status<>'sent' then
    raise exception 'A confirmed successful test is required before the one permitted resend';
  end if;
end $$;

with request as (select gen_random_uuid() as request_key)
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='weekly_summary_function_url'),
  headers := jsonb_build_object('Content-Type','application/json','x-weekly-summary-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='weekly_summary_cron_secret')),
  body := jsonb_build_object('mode','watch_test','request_key',request.request_key::text)
) as request_id
from request;
