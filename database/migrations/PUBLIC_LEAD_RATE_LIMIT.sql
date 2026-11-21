-- Apply after LEADS_SCHEMA and COMPANY_MODULES. No existing leads are changed.
begin;
create table public.public_lead_rate_buckets(
  company_id uuid not null references public.companies(id) on delete cascade,
  scope_key text not null check(scope_key='company' or scope_key ~ '^client:[0-9a-f]{64}$'),
  bucket_start timestamptz not null,
  attempts integer not null check(attempts between 1 and 100),
  expires_at timestamptz not null,
  primary key(company_id,scope_key,bucket_start)
);
create index public_lead_rate_expiry_idx on public.public_lead_rate_buckets(expires_at);
alter table public.public_lead_rate_buckets enable row level security;
revoke all on public.public_lead_rate_buckets from public,anon,authenticated,service_role;

create function public.reserve_public_lead_attempt(p_company uuid,p_client_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=clock_timestamp(); client_start timestamptz;company_start timestamptz;
begin
  if p_company is null or p_client_key is null or p_client_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid reservation' using errcode='22023';
  end if;
  -- A shared tenant lock serializes checks/increments across API instances.
  perform 1 from public.companies where id=p_company for no key update;
  if not found or not exists(select 1 from public.company_modules where company_id=p_company and module_key='crm' and is_enabled) then
    raise exception 'Requests unavailable' using errcode='42501';
  end if;
  delete from public.public_lead_rate_buckets where company_id=p_company and expires_at<stamp;
  client_start:=date_bin(interval '15 minutes',stamp,timestamptz '2000-01-01 00:00:00+00');
  company_start:=date_bin(interval '1 hour',stamp,timestamptz '2000-01-01 00:00:00+00');
  if coalesce((select attempts from public.public_lead_rate_buckets where company_id=p_company and scope_key='company' and bucket_start=company_start),0)>=100
    or coalesce((select attempts from public.public_lead_rate_buckets where company_id=p_company and scope_key='client:'||p_client_key and bucket_start=client_start),0)>=5 then
    return false;
  end if;
  insert into public.public_lead_rate_buckets values(p_company,'company',company_start,1,company_start+interval '3 hours')
    on conflict(company_id,scope_key,bucket_start) do update set attempts=public.public_lead_rate_buckets.attempts+1;
  insert into public.public_lead_rate_buckets values(p_company,'client:'||p_client_key,client_start,1,client_start+interval '3 hours')
    on conflict(company_id,scope_key,bucket_start) do update set attempts=public.public_lead_rate_buckets.attempts+1;
  return true;
end $$;
create function public.purge_public_lead_rate_buckets()
returns void language sql security definer set search_path='' as $$
  delete from public.public_lead_rate_buckets where expires_at<clock_timestamp()
$$;
revoke all on function public.reserve_public_lead_attempt(uuid,text),public.purge_public_lead_rate_buckets() from public,anon,authenticated,service_role;
grant execute on function public.reserve_public_lead_attempt(uuid,text),public.purge_public_lead_rate_buckets() to service_role;
-- Use existing pg_cron when installed; otherwise arrange an hourly service job.
do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('purge-public-lead-rate-buckets','17 * * * *','select public.purge_public_lead_rate_buckets()');
  end if;
end $$;
notify pgrst,'reload schema';
commit;
