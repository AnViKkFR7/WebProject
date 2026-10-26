-- Configurable due-date reminders. This migration only creates settings,
-- invoice opt-outs and a deduplicated queue; it does not send email or schedule a job.
-- Apply after BILLING_PAYMENTS_HISTORY.sql and COMPANY_MODULES.sql.
begin;

create table if not exists public.billing_due_reminder_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  offsets_days integer[] not null default array[7,1,0,-7],
  local_send_time time not null default time '09:00',
  timezone text not null default 'Europe/Madrid' check(timezone='Europe/Madrid'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check(cardinality(offsets_days) between 1 and 8),
  check(array_position(offsets_days,null) is null)
);

create table if not exists public.billing_invoice_reminder_preferences (
  company_id uuid not null,
  invoice_id uuid not null,
  suppressed boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(company_id,invoice_id),
  foreign key(company_id,invoice_id) references public.invoices(company_id,id) on delete cascade
);

create table if not exists public.billing_due_reminder_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  invoice_id uuid not null,
  due_date date not null,
  offset_days integer not null check(offset_days between -90 and 90),
  scheduled_for timestamptz not null,
  status text not null default 'queued' check(status in('queued','sending','sent','dead','skipped')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  delivery_generation integer not null default 0 check(delivery_generation>=0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  last_error_code text check(last_error_code is null or last_error_code in('invoice_unavailable','recipient_unavailable','module_disabled','reminders_disabled','schedule_changed','suppressed','balance_settled','provider_unavailable','provider_rejected','sent_marker_failed','unexpected_failure')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(company_id,invoice_id,due_date,offset_days),
  foreign key(company_id,invoice_id) references public.invoices(company_id,id) on delete cascade
);
create index if not exists billing_due_reminder_ready_idx on public.billing_due_reminder_queue(available_at,scheduled_for,created_at) where status in('queued','sending');
create index if not exists billing_due_reminder_company_idx on public.billing_due_reminder_queue(company_id,status,updated_at desc);

alter table public.billing_due_reminder_settings enable row level security;
alter table public.billing_invoice_reminder_preferences enable row level security;
alter table public.billing_due_reminder_queue enable row level security;
revoke all on public.billing_due_reminder_settings,public.billing_invoice_reminder_preferences,public.billing_due_reminder_queue from public,anon,authenticated;
grant select on public.billing_due_reminder_settings,public.billing_invoice_reminder_preferences to authenticated;
grant select on public.billing_due_reminder_queue to authenticated;
grant select,insert,update on public.billing_due_reminder_queue to service_role;

create policy billing_due_settings_read on public.billing_due_reminder_settings for select to authenticated
  using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor','viewer']));
create policy billing_due_preferences_read on public.billing_invoice_reminder_preferences for select to authenticated
  using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor','viewer']));
create policy billing_due_queue_read on public.billing_due_reminder_queue for select to authenticated
  using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor','viewer']));

create policy billing_due_settings_module_gate on public.billing_due_reminder_settings as restrictive for all to authenticated
  using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
create policy billing_due_preferences_module_gate on public.billing_invoice_reminder_preferences as restrictive for all to authenticated
  using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));
create policy billing_due_queue_module_gate on public.billing_due_reminder_queue as restrictive for all to authenticated
  using(public.is_company_module_enabled(company_id,'billing')) with check(public.is_company_module_enabled(company_id,'billing'));

create or replace function public.billing_safe_document_date(p_value text)
returns date language plpgsql immutable set search_path='' as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then return null;end if;
  return p_value::date;
exception when others then return null;
end $$;

create or replace function public.save_billing_due_reminder_settings(p_company uuid,p_enabled boolean,p_offsets integer[],p_send_time time default time '09:00')
returns public.billing_due_reminder_settings language plpgsql security definer set search_path='' as $$
declare result public.billing_due_reminder_settings;previous public.billing_due_reminder_settings;
begin
  if not(public.is_platform_admin() or public.has_company_role(p_company,array['admin'])) then raise exception 'Forbidden' using errcode='42501';end if;
  if p_enabled and not public.is_company_module_enabled(p_company,'billing') then raise exception 'Company module is disabled' using errcode='42501';end if;
  if p_offsets is null or cardinality(p_offsets)<1 or cardinality(p_offsets)>8 or array_position(p_offsets,null) is not null
    or exists(select 1 from unnest(p_offsets) d where d < -90 or d > 90) or p_send_time is null then
    raise exception 'Invalid reminder settings' using errcode='22023';
  end if;
  select * into previous from public.billing_due_reminder_settings where company_id=p_company;
  insert into public.billing_due_reminder_settings(company_id,enabled,offsets_days,local_send_time,updated_by)
    values(p_company,p_enabled,(select array_agg(distinct d order by d desc) from unnest(p_offsets) d),p_send_time,auth.uid())
  on conflict(company_id) do update set enabled=excluded.enabled,offsets_days=excluded.offsets_days,local_send_time=excluded.local_send_time,updated_at=now(),updated_by=auth.uid()
  returning * into result;
  if not p_enabled or previous.company_id is null or previous.enabled is distinct from p_enabled
    or previous.offsets_days is distinct from result.offsets_days or previous.local_send_time is distinct from result.local_send_time then
    update public.billing_due_reminder_queue set status='skipped',locked_at=null,last_error_code=case when p_enabled then 'schedule_changed' else 'reminders_disabled' end,updated_at=now()
      where company_id=p_company and status in('queued','sending');
  end if;
  return result;
end $$;

create or replace function public.set_invoice_due_reminders(p_company uuid,p_invoice uuid,p_suppressed boolean)
returns public.billing_invoice_reminder_preferences language plpgsql security definer set search_path='' as $$
declare result public.billing_invoice_reminder_preferences;
begin
  perform public.assert_billing_access(p_company);
  if not public.is_company_module_enabled(p_company,'billing') then raise exception 'Company module is disabled' using errcode='42501';end if;
  if not exists(select 1 from public.invoices where company_id=p_company and id=p_invoice and status='issued') then
    raise exception 'Invoice unavailable' using errcode='40001';
  end if;
  insert into public.billing_invoice_reminder_preferences(company_id,invoice_id,suppressed,updated_by)
    values(p_company,p_invoice,p_suppressed,auth.uid())
  on conflict(company_id,invoice_id) do update set suppressed=excluded.suppressed,updated_at=now(),updated_by=auth.uid()
  returning * into result;
  if p_suppressed then
    update public.billing_due_reminder_queue set status='skipped',locked_at=null,last_error_code='suppressed',updated_at=now()
      where company_id=p_company and invoice_id=p_invoice and status in('queued','sending');
  end if;
  return result;
end $$;

-- Service-role cron/worker entrypoint. It stores no customer name, email or document body.
-- Idempotency is the unique company/invoice/due-date/offset key.
create or replace function public.enqueue_billing_due_reminders(p_as_of date default ((now() at time zone 'Europe/Madrid')::date))
returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
  insert into public.billing_due_reminder_queue(company_id,invoice_id,due_date,offset_days,scheduled_for)
  select i.company_id,i.id,public.billing_safe_document_date(i.document->>'dueDate'),d.offset_day,
    ((p_as_of + s.local_send_time) at time zone s.timezone)
  from public.billing_due_reminder_settings s
  join public.invoices i on i.company_id=s.company_id and i.status='issued'
  cross join lateral unnest(s.offsets_days) d(offset_day)
  left join public.billing_invoice_reminder_preferences pref on pref.company_id=i.company_id and pref.invoice_id=i.id
  cross join lateral(select public.billing_document_total(i.document) total) totals
  where s.enabled and public.is_company_module_enabled(i.company_id,'billing')
    and coalesce(pref.suppressed,false)=false
    and public.billing_safe_document_date(i.document->>'dueDate') is not null
    and public.billing_safe_document_date(i.document->>'dueDate') - d.offset_day = p_as_of
    and totals.total-coalesce((select sum(case when p.entry_type='payment' then p.amount else -p.amount end) from public.billing_payment_entries p where p.company_id=i.company_id and p.invoice_id=i.id),0)>0
  on conflict(company_id,invoice_id,due_date,offset_days) do update set status='queued',scheduled_for=excluded.scheduled_for,
    available_at=now(),attempt_count=0,locked_at=null,last_error_code=null,updated_at=now()
    where public.billing_due_reminder_queue.status='skipped'
      and public.billing_due_reminder_queue.last_error_code in('schedule_changed','reminders_disabled','module_disabled','suppressed');
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

create or replace function public.claim_billing_due_reminder_batch(p_limit integer default 25)
returns table(queue_id uuid,job_company_id uuid,job_invoice_id uuid,job_due_date date,job_offset_days integer,job_attempt_count integer,delivery_generation integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid batch size' using errcode='22023';end if;
  update public.billing_due_reminder_queue q set status='dead',locked_at=null,last_error_code='sent_marker_failed',updated_at=now()
    where q.status='sending' and q.locked_at<now()-interval '20 hours';
  update public.billing_due_reminder_queue q set status='dead',locked_at=null,last_error_code='unexpected_failure',updated_at=now()
    where q.status='sending' and q.locked_at<now()-interval '10 minutes' and q.attempt_count>=8;
  update public.billing_due_reminder_queue q set status='skipped',locked_at=null,
    last_error_code=case when not public.is_company_module_enabled(q.company_id,'billing') then 'module_disabled'
      when not coalesce(s.enabled,false) then 'reminders_disabled'
      when coalesce(pref.suppressed,false) then 'suppressed'
      when i.id is null or i.status<>'issued' then 'invoice_unavailable'
      when coalesce(t.total,0)-coalesce(pay.paid,0)<=0 then 'balance_settled' else 'invoice_unavailable' end,
    updated_at=now()
  from public.invoices i
  left join public.billing_due_reminder_settings s on s.company_id=i.company_id
  left join public.billing_invoice_reminder_preferences pref on pref.company_id=i.company_id and pref.invoice_id=i.id
  cross join lateral(select public.billing_document_total(i.document) total)t
  left join lateral(select sum(case when e.entry_type='payment' then e.amount else -e.amount end) paid from public.billing_payment_entries e where e.company_id=i.company_id and e.invoice_id=i.id) pay on true
  where q.invoice_id=i.id and q.company_id=i.company_id and q.status in('queued','sending')
    and (not public.is_company_module_enabled(q.company_id,'billing') or not coalesce(s.enabled,false) or coalesce(pref.suppressed,false) or i.status<>'issued' or coalesce(t.total,0)-coalesce(pay.paid,0)<=0);
  return query
  with picked as(
    select q.id from public.billing_due_reminder_queue q
    join public.invoices i on i.id=q.invoice_id and i.company_id=q.company_id and i.status='issued'
    join public.billing_due_reminder_settings s on s.company_id=q.company_id and s.enabled
    where q.attempt_count<8 and q.available_at<=now() and q.scheduled_for<=now()
      and public.is_company_module_enabled(q.company_id,'billing')
      and not coalesce((select pref.suppressed from public.billing_invoice_reminder_preferences pref where pref.company_id=q.company_id and pref.invoice_id=q.invoice_id),false)
      and public.billing_document_total(i.document)-coalesce((select sum(case when e.entry_type='payment' then e.amount else -e.amount end) from public.billing_payment_entries e where e.company_id=q.company_id and e.invoice_id=q.invoice_id),0)>0
      and (q.status='queued' or (q.status='sending' and q.locked_at<now()-interval '10 minutes'))
    order by q.available_at,q.scheduled_for,q.created_at for update of q skip locked limit p_limit
  )
  update public.billing_due_reminder_queue q set status='sending',attempt_count=q.attempt_count+1,locked_at=now(),updated_at=now()
  from picked where q.id=picked.id
  returning q.id,q.company_id,q.invoice_id,q.due_date,q.offset_days,q.attempt_count,q.delivery_generation;
end $$;

-- Resolve only the data explicitly needed for delivery, and recheck all gates
-- immediately before the worker contacts the provider.
create or replace function public.get_billing_due_reminder_payload(p_queue uuid)
returns table(company_id uuid,invoice_id uuid,recipient_email text,invoice_number text,due_date date,balance numeric)
language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.billing_due_reminder_queue;i public.invoices;reminder_enabled boolean;is_suppressed boolean;paid numeric;total numeric;
begin
  select * into q from public.billing_due_reminder_queue where id=p_queue and status='sending' for update;
  if not found then return;end if;
  select inv.* into i from public.invoices inv where inv.id=q.invoice_id and inv.company_id=q.company_id;
  select coalesce((select s.enabled from public.billing_due_reminder_settings s where s.company_id=q.company_id),false) into reminder_enabled;
  select coalesce((select pref.suppressed from public.billing_invoice_reminder_preferences pref where pref.company_id=q.company_id and pref.invoice_id=q.invoice_id),false) into is_suppressed;
  if not public.is_company_module_enabled(q.company_id,'billing') or not reminder_enabled or is_suppressed or i.id is null or i.status<>'issued' then
    update public.billing_due_reminder_queue set status='skipped',locked_at=null,last_error_code=case
      when not public.is_company_module_enabled(q.company_id,'billing') then 'module_disabled'
      when not reminder_enabled then 'reminders_disabled'
      when is_suppressed then 'suppressed' else 'invoice_unavailable' end,updated_at=now() where id=q.id;
    return;
  end if;
  total:=public.billing_document_total(i.document);
  select coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0) into paid
    from public.billing_payment_entries e where e.company_id=q.company_id and e.invoice_id=q.invoice_id;
  if total-paid<=0 then
    update public.billing_due_reminder_queue set status='skipped',locked_at=null,last_error_code='balance_settled',updated_at=now() where id=q.id;
    return;
  end if;
  return query select i.company_id,i.id,nullif(trim(i.document#>>'{customer,email}'),''),i.number,
    public.billing_safe_document_date(i.document->>'dueDate'),greatest(total-paid,0)::numeric;
end $$;

create or replace function public.complete_billing_due_reminder(p_queue uuid,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.billing_due_reminder_queue set status='sent',provider_message_id=left(p_provider_id,200),last_error_code=null,locked_at=null,sent_at=now(),updated_at=now()
    where id=p_queue and status='sending';
  return found;
end $$;

create or replace function public.fail_billing_due_reminder(p_queue uuid,p_error_code text,p_retryable boolean default true,p_provider_id text default null)
returns text language plpgsql security definer set search_path='' as $$
declare q public.billing_due_reminder_queue;next_status text;
begin
  if p_error_code is null or p_error_code not in('invoice_unavailable','recipient_unavailable','module_disabled','suppressed','balance_settled','provider_unavailable','provider_rejected','sent_marker_failed','unexpected_failure') or p_retryable is null then raise exception 'Invalid error code' using errcode='22023';end if;
  select * into q from public.billing_due_reminder_queue where id=p_queue and status='sending' for update;
  if not found then return null;end if;
  next_status:=case when p_error_code<>'sent_marker_failed' and p_retryable and q.attempt_count<8 then 'queued' else 'dead' end;
  update public.billing_due_reminder_queue set status=next_status,available_at=case when next_status='queued' then now()+make_interval(secs=>least(3600,(30*power(2,greatest(q.attempt_count-1,0)))::integer)) else available_at end,
    locked_at=null,last_error_code=p_error_code,provider_message_id=coalesce(left(p_provider_id,200),provider_message_id),updated_at=now() where id=p_queue;
  return next_status;
end $$;

drop function if exists public.list_billing_due_reminder_failures(uuid);
create or replace function public.list_billing_due_reminder_failures(p_company uuid)
returns table(company_id uuid,id uuid,invoice_id uuid,invoice_number text,customer_name text,due_date date,offset_days integer,last_error_code text,attempt_count integer,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_company_role(p_company,array['admin','editor','viewer']) then raise exception 'Forbidden' using errcode='42501';end if;
  return query select q.company_id,q.id,q.invoice_id,i.number,coalesce(i.document#>>'{customer,name}',''),q.due_date,q.offset_days,q.last_error_code,q.attempt_count,q.updated_at
    from public.billing_due_reminder_queue q join public.invoices i on i.id=q.invoice_id and i.company_id=q.company_id
    where q.company_id=p_company and q.status='dead' order by q.updated_at desc limit 100;
end $$;

create or replace function public.retry_billing_due_reminder(p_company uuid,p_queue uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not public.has_company_role(p_company,array['admin','editor']) then raise exception 'Forbidden' using errcode='42501';end if;
  update public.billing_due_reminder_queue set status='queued',attempt_count=0,delivery_generation=delivery_generation+1,available_at=now(),locked_at=null,last_error_code=null,updated_at=now()
    where id=p_queue and company_id=p_company and status='dead' and last_error_code is distinct from 'sent_marker_failed' and provider_message_id is null;
  return found;
end $$;

create or replace function public.purge_billing_due_reminder_queue()
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  delete from public.billing_due_reminder_queue where (status='sent' and sent_at<now()-interval '90 days') or(status in('dead','skipped') and updated_at<now()-interval '180 days');
  get diagnostics removed=row_count;return removed;
end $$;

revoke all on function public.save_billing_due_reminder_settings(uuid,boolean,integer[],time),public.set_invoice_due_reminders(uuid,uuid,boolean),public.enqueue_billing_due_reminders(date),public.billing_safe_document_date(text),public.claim_billing_due_reminder_batch(integer),public.get_billing_due_reminder_payload(uuid),public.complete_billing_due_reminder(uuid,text),public.fail_billing_due_reminder(uuid,text,boolean,text),public.purge_billing_due_reminder_queue() from public,anon,authenticated;
revoke all on function public.list_billing_due_reminder_failures(uuid),public.retry_billing_due_reminder(uuid,uuid) from public,anon;
grant execute on function public.save_billing_due_reminder_settings(uuid,boolean,integer[],time),public.set_invoice_due_reminders(uuid,uuid,boolean) to authenticated;
grant execute on function public.enqueue_billing_due_reminders(date),public.claim_billing_due_reminder_batch(integer),public.get_billing_due_reminder_payload(uuid),public.complete_billing_due_reminder(uuid,text),public.fail_billing_due_reminder(uuid,text,boolean,text),public.purge_billing_due_reminder_queue() to service_role;
grant execute on function public.list_billing_due_reminder_failures(uuid),public.retry_billing_due_reminder(uuid,uuid) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
