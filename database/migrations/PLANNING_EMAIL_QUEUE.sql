-- Durable, tenant-scoped retry queue for Planning reminder emails.
-- Apply after PLANNING_REMINDER_PAYLOAD_FIX.sql. The Edge Function remains
-- the only sender; this migration does not schedule or invoke external services.
begin;

create unique index if not exists planning_task_company_id_unique on public.planning_task(company_id,id);

create table if not exists public.planning_email_queue (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.planning_task(id) on delete cascade,
  company_id uuid not null,
  recipient_id uuid not null,
  minutes_before integer not null check(minutes_before in(0,60,1440,10080)),
  occurrence_at timestamptz not null,
  status text not null default 'queued' check(status in('queued','sending','sent','dead','skipped')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  delivery_generation integer not null default 0 check(delivery_generation>=0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  last_error_code text check(last_error_code is null or last_error_code in(
    'recipient_unavailable','membership_inactive','task_unavailable','task_lookup_failed',
    'company_lookup_failed','client_lookup_failed','provider_unavailable','provider_rejected',
    'sent_marker_failed','unexpected_failure')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(task_id,minutes_before,occurrence_at),
  unique(company_id,id),
  foreign key(company_id,task_id) references public.planning_task(company_id,id) on delete cascade
);
alter table public.planning_email_queue add column if not exists delivery_generation integer not null default 0 check(delivery_generation>=0);
create index if not exists planning_email_queue_due_idx
  on public.planning_email_queue(available_at,created_at) where status in('queued','sending');
create index if not exists planning_email_queue_company_failed_idx
  on public.planning_email_queue(company_id,updated_at desc) where status='dead';
alter table public.planning_email_queue enable row level security;
revoke all on public.planning_email_queue from public,anon,authenticated;
grant select,insert,update on public.planning_email_queue to service_role;
grant insert,select on public.planning_reminder_sent to service_role;

create or replace function public.enqueue_due_planning_emails(p_window_minutes integer default 10)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare inserted_count integer;
begin
  if p_window_minutes is null or p_window_minutes<1 or p_window_minutes>60 then raise exception 'Invalid reminder window' using errcode='22023';end if;
  insert into public.planning_email_queue(task_id,company_id,recipient_id,minutes_before,occurrence_at)
  select d.task_id,d.company_id,d.created_by,d.minutes_before,d.occurrence_at
  from public.due_planning_reminders(p_window_minutes) d
  where d.created_by is not null
  on conflict(task_id,minutes_before,occurrence_at) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

drop function if exists public.claim_planning_email_batch(integer);
create or replace function public.claim_planning_email_batch(p_limit integer default 25)
returns table(queue_id uuid,task_id uuid,company_id uuid,recipient_id uuid,minutes_before integer,occurrence_at timestamptz,attempt_count integer,delivery_generation integer)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid batch size' using errcode='22023';end if;
  -- Resend only retains an idempotency key for 24h. If a claimed job is
  -- still leased after 20h, delivery is uncertain; never retry it after the
  -- provider may have forgotten the key.
  update public.planning_email_queue q set status='dead',locked_at=null,last_error_code='sent_marker_failed',updated_at=now()
    where q.status='sending' and q.locked_at<now()-interval '20 hours';
  update public.planning_email_queue q set status='dead',locked_at=null,last_error_code='unexpected_failure',updated_at=now()
    where q.status='sending' and q.locked_at<now()-interval '10 minutes' and q.attempt_count>=8;
  return query
  with picked as(
    select q.id from public.planning_email_queue q
    where q.attempt_count<8 and ((q.status='queued' and q.available_at<=now()) or(q.status='sending' and q.locked_at<now()-interval '10 minutes'))
    order by q.available_at,q.created_at for update skip locked limit p_limit
  )
  update public.planning_email_queue q set status='sending',attempt_count=q.attempt_count+1,locked_at=now(),updated_at=now()
  from picked where q.id=picked.id
  returning q.id,q.task_id,q.company_id,q.recipient_id,q.minutes_before,q.occurrence_at,q.attempt_count,q.delivery_generation;
end $$;

create or replace function public.complete_planning_email(p_queue uuid,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare q public.planning_email_queue;
begin
  update public.planning_email_queue set status='sent',provider_message_id=left(p_provider_id,200),last_error_code=null,locked_at=null,sent_at=now(),updated_at=now()
    where id=p_queue and status='sending' returning * into q;
  if not found then return false;end if;
  insert into public.planning_reminder_sent(task_id,minutes_before,occurrence_at)
    values(q.task_id,q.minutes_before,q.occurrence_at) on conflict do nothing;
  return true;
end $$;

drop function if exists public.fail_planning_email(uuid,text,boolean);
create or replace function public.fail_planning_email(p_queue uuid,p_error_code text,p_retryable boolean default true,p_provider_id text default null)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare q public.planning_email_queue; next_status text;
begin
  if p_error_code is null or p_error_code not in('recipient_unavailable','membership_inactive','task_unavailable','task_lookup_failed','company_lookup_failed','client_lookup_failed','provider_unavailable','provider_rejected','sent_marker_failed','unexpected_failure') or p_retryable is null then raise exception 'Invalid error code' using errcode='22023';end if;
  select * into q from public.planning_email_queue where id=p_queue and status='sending' for update;
  if not found then return null;end if;
  next_status:=case when p_error_code<>'sent_marker_failed' and p_retryable and q.attempt_count<8 then 'queued' else 'dead' end;
  update public.planning_email_queue set status=next_status,available_at=case when next_status='queued' then now()+make_interval(secs=>least(3600,(30*power(2,greatest(q.attempt_count-1,0)))::integer)) else available_at end,
    locked_at=null,last_error_code=p_error_code,provider_message_id=coalesce(left(p_provider_id,200),provider_message_id),updated_at=now() where id=p_queue;
  return next_status;
end $$;

create or replace function public.list_planning_email_failures(p_company uuid)
returns table(id uuid,task_id uuid,task_title text,occurrence_at timestamptz,last_error_code text,attempt_count integer,updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.has_company_role(p_company,array['admin','editor','viewer']) then raise exception 'Forbidden' using errcode='42501';end if;
  return query select q.id,q.task_id,t.title,q.occurrence_at,q.last_error_code,q.attempt_count,q.updated_at
    from public.planning_email_queue q join public.planning_task t on t.id=q.task_id and t.company_id=q.company_id
    where q.company_id=p_company and q.status='dead' order by q.updated_at desc limit 100;
end $$;

create or replace function public.retry_planning_email(p_company uuid,p_queue uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.has_company_role(p_company,array['admin','editor']) then raise exception 'Forbidden' using errcode='42501';end if;
  update public.planning_email_queue set status='queued',attempt_count=0,delivery_generation=delivery_generation+1,available_at=now(),locked_at=null,last_error_code=null,updated_at=now()
    where id=p_queue and company_id=p_company and status='dead' and last_error_code is distinct from 'sent_marker_failed' and provider_message_id is null;
  return found;
end $$;

create or replace function public.purge_planning_email_queue()
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare removed integer;
begin
  delete from public.planning_email_queue where (status='sent' and sent_at<now()-interval '90 days')
    or (status in('dead','skipped') and updated_at<now()-interval '180 days');
  get diagnostics removed=row_count;
  return removed;
end $$;

revoke all on function public.enqueue_due_planning_emails(integer),public.claim_planning_email_batch(integer),public.complete_planning_email(uuid,text),public.fail_planning_email(uuid,text,boolean,text),public.purge_planning_email_queue() from public,anon,authenticated;
grant execute on function public.enqueue_due_planning_emails(integer),public.claim_planning_email_batch(integer),public.complete_planning_email(uuid,text),public.fail_planning_email(uuid,text,boolean,text),public.purge_planning_email_queue() to service_role;
revoke all on function public.list_planning_email_failures(uuid),public.retry_planning_email(uuid,uuid) from public,anon;
grant execute on function public.list_planning_email_failures(uuid) to authenticated,service_role;
grant execute on function public.retry_planning_email(uuid,uuid) to authenticated,service_role;

commit;
