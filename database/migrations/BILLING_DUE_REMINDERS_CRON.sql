-- Schedule the worker only after BILLING_DUE_REMINDERS.sql, Edge deployment,
-- and Resend configuration. Store URL and secret in Supabase Vault first.
-- Generate a random secret locally and configure the same value as
-- BILLING_REMINDERS_CRON_SECRET in the Edge Function secrets:
--
-- select vault.create_secret('<RANDOM_SECRET>', 'billing_due_reminders_cron_secret', 'Authorizes the billing reminder cron');
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/send-billing-due-reminders', 'billing_due_reminders_function_url', 'Billing reminder Edge Function URL');
--
-- Replace both placeholders before running those two commands. Do not commit
-- the resulting secret or paste it into cron.job.
do $$
begin
  if not exists(select 1 from vault.secrets where name='billing_due_reminders_cron_secret')
    or not exists(select 1 from vault.secrets where name='billing_due_reminders_function_url') then
    raise exception 'Create both billing reminder secrets in Vault before scheduling';
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname='billing-due-reminders';
select cron.schedule('billing-due-reminders','*/5 * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='billing_due_reminders_function_url'),
    headers := jsonb_build_object('Content-Type','application/json','x-billing-reminders-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='billing_due_reminders_cron_secret')),
    body := '{}'::jsonb
  );
$job$);

select cron.unschedule(jobid) from cron.job where jobname='billing-due-reminders-purge';
select cron.schedule('billing-due-reminders-purge','35 3 * * *',
  $$select public.purge_billing_due_reminder_queue();$$);
