-- Apply after PLANNING_TASK_MOVE_UNDO, PLANNING_RECURRENCE_WINDOW and COMPANY_MODULES_RPC_COMPLETION.
-- Pause the reminder scheduler until SQL and the matching Edge worker are deployed.
begin;
alter table public.planning_email_queue add column task_version integer check(task_version>0);
-- Never guess the payload/version of an already attempted legacy delivery.
update public.planning_email_queue set status='dead',locked_at=null,last_error_code='sent_marker_failed',updated_at=now()
 where status in('queued','sending') and attempt_count>0;
update public.planning_email_queue q set task_version=t.version
 from public.planning_task t where t.id=q.task_id and t.company_id=q.company_id and q.attempt_count=0 and q.status in('queued','skipped');

create function public.invalidate_changed_planning_emails()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.planning_email_queue set status='skipped',locked_at=null,last_error_code='task_unavailable',updated_at=now()
 where task_id=new.id and company_id=new.company_id and status in('queued','sending');
 return new;
end $$;
revoke all on function public.invalidate_changed_planning_emails() from public,anon,authenticated,service_role;
create trigger planning_email_task_changed after update on public.planning_task
 for each row when (old.version is distinct from new.version) execute function public.invalidate_changed_planning_emails();

create or replace function public.enqueue_due_planning_emails(p_window_minutes integer default 10)
returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
 if p_window_minutes is null or p_window_minutes<1 or p_window_minutes>60 then raise exception 'Invalid reminder window' using errcode='22023';end if;
 insert into public.planning_email_queue(task_id,company_id,recipient_id,minutes_before,occurrence_at,task_version)
 select d.task_id,d.company_id,d.created_by,d.minutes_before,d.occurrence_at,t.version
 from public.due_planning_reminders(p_window_minutes) d join public.planning_task t on t.id=d.task_id and t.company_id=d.company_id
 where d.created_by is not null and public.is_company_module_enabled(d.company_id,'planning')
 on conflict(task_id,minutes_before,occurrence_at) do update set recipient_id=excluded.recipient_id,task_version=excluded.task_version,
   status='queued',available_at=now(),locked_at=null,last_error_code=null,updated_at=now()
 where public.planning_email_queue.status='skipped' and public.planning_email_queue.attempt_count=0
   and public.planning_email_queue.delivery_generation=0 and public.planning_email_queue.provider_message_id is null;
 get diagnostics inserted_count=row_count;return inserted_count;
end $$;

create function public.validate_planning_email_delivery(p_queue uuid,p_company uuid,p_task uuid,p_version integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare q public.planning_email_queue;t public.planning_task;step interval;n bigint;valid boolean;
begin
 -- Lock order matches task edits (task, then queue), avoiding inversion with the trigger.
 select * into t from public.planning_task where id=p_task and company_id=p_company for share;
 if not found then return false;end if;
 select * into q from public.planning_email_queue where id=p_queue and company_id=p_company and task_id=p_task for update;
 if not found or q.status<>'sending' then return false;end if;
 valid:=coalesce(p_version=t.version and q.task_version=t.version and q.recipient_id=t.created_by
   and q.minutes_before=any(t.reminders) and public.is_company_module_enabled(p_company,'planning')
   and exists(select 1 from public.company_members m where m.company_id=p_company and m.user_id=q.recipient_id and m.is_active),false);
 if valid then
   step:=public.planning_recurrence_step(t.recurrence_type,t.recurrence_value);
   if step is null then valid:=coalesce(q.occurrence_at=t.start_datetime,false);
   else
     n:=public.planning_recurrence_index(t.start_datetime,q.occurrence_at,t.recurrence_type,t.recurrence_value);
     select exists(select 1 from generate_series(greatest(n-1,0),greatest(n+1,0)) k
       where public.planning_occurrence_at(t.start_datetime,step,k,t.recurrence_type)=q.occurrence_at) into valid;
   end if;
 end if;
 if not valid then
   update public.planning_email_queue set status='skipped',locked_at=null,last_error_code='task_unavailable',updated_at=now() where id=q.id;
 end if;
 return valid;
end $$;
revoke all on function public.validate_planning_email_delivery(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.validate_planning_email_delivery(uuid,uuid,uuid,integer) to service_role;

create or replace function public.complete_planning_email(p_queue uuid,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare q public.planning_email_queue;
begin
  update public.planning_email_queue set status='sent',provider_message_id=left(p_provider_id,200),last_error_code=null,locked_at=null,sent_at=now(),updated_at=now()
    where id=p_queue and status in('sending','skipped') returning * into q;
  if not found then return false;end if;
  insert into public.planning_reminder_sent(task_id,minutes_before,occurrence_at)
    values(q.task_id,q.minutes_before,q.occurrence_at) on conflict do nothing;
  return true;
end $$;

create or replace function public.retry_planning_email(p_company uuid,p_queue uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.has_company_role(p_company,array['admin','editor']) then raise exception 'Forbidden' using errcode='42501';end if;
  perform public.assert_company_module_enabled(p_company,'planning');
  update public.planning_email_queue set status='queued',attempt_count=0,delivery_generation=delivery_generation+1,available_at=now(),locked_at=null,last_error_code=null,updated_at=now()
    where id=p_queue and company_id=p_company and status='dead' and last_error_code is distinct from 'sent_marker_failed' and provider_message_id is null
    and exists(select 1 from public.planning_task t where t.company_id=p_company and t.id=task_id and t.version=task_version);
  return found;
end $$;
notify pgrst,'reload schema';
commit;
