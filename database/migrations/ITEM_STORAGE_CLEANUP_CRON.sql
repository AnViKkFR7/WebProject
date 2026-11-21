-- Optional scheduling, after ITEM_STORAGE_CLEANUP_QUEUE and Edge deployment.
-- Requires pg_cron, pg_net and Supabase Vault already configured.
-- Create the same random value in Edge as ITEM_MEDIA_CLEANUP_CRON_SECRET.
-- select vault.create_secret('<RANDOM_SECRET>','item_media_cleanup_cron_secret','Authorizes item Storage cleanup');
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-item-media','item_media_cleanup_function_url','Item Storage cleanup URL');
do $$ begin
 if not exists(select 1 from vault.secrets where name='item_media_cleanup_cron_secret')
 or not exists(select 1 from vault.secrets where name='item_media_cleanup_function_url') then
  raise exception 'Create both item media cleanup secrets in Vault before scheduling';
 end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='item-media-storage-cleanup';
select cron.schedule('item-media-storage-cleanup','*/5 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='item_media_cleanup_function_url'),
  headers:=jsonb_build_object('Content-Type','application/json','x-item-media-cleanup-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='item_media_cleanup_cron_secret')),
  body:='{}'::jsonb
 );
$job$);
