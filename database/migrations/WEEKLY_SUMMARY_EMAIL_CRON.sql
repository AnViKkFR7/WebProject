-- Apply after WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql, deploying send-weekly-summary and
-- configuring its Edge/Vault secrets. Safe to rerun: replaces fixed job names.
-- Create the same random value in Edge as WEEKLY_SUMMARY_CRON_SECRET.
-- select vault.create_secret('<RANDOM_SECRET>','weekly_summary_cron_secret','Authorizes the weekly summary cron');
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/send-weekly-summary','weekly_summary_function_url','Weekly summary Edge Function URL');
do $$ begin
  if not exists(select 1 from vault.secrets where name='weekly_summary_cron_secret')
    or not exists(select 1 from vault.secrets where name='weekly_summary_function_url') then
    raise exception 'Create both weekly summary secrets in Vault before scheduling';
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname='weekly-summary-email';
select cron.schedule('weekly-summary-email','*/5 * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='weekly_summary_function_url'),
    headers := jsonb_build_object('Content-Type','application/json','x-weekly-summary-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='weekly_summary_cron_secret')),
    body := '{}'::jsonb
  );
$job$);

select cron.unschedule(jobid) from cron.job where jobname='weekly-summary-email-purge';
select cron.schedule('weekly-summary-email-purge','40 3 * * *',
  $$select public.purge_company_weekly_summary_queue();$$);
