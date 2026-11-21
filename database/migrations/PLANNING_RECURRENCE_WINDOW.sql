-- Apply after PLANNING_REMINDER_PAYLOAD_FIX and COMPANY_MODULES.
begin;
create or replace function public.planning_recurrence_index(p_start timestamptz,p_at timestamptz,p_type text,p_value integer)
returns bigint language sql immutable set search_path='' as $$
  select floor(case p_type
    when 'hourly' then extract(epoch from (p_at-p_start))/3600
    when 'daily' then ((p_at at time zone 'Europe/Madrid')::date-(p_start at time zone 'Europe/Madrid')::date)::numeric
    when 'weekly' then ((p_at at time zone 'Europe/Madrid')::date-(p_start at time zone 'Europe/Madrid')::date)::numeric/7
    when 'yearly' then extract(year from p_at at time zone 'Europe/Madrid')-extract(year from p_start at time zone 'Europe/Madrid')
    else 0 end/greatest(coalesce(p_value,1),1))::bigint
$$;
revoke all on function public.planning_recurrence_index(timestamptz,timestamptz,text,integer) from public,anon,authenticated;

create or replace function public.due_planning_reminders(window_minutes integer default 10)
returns table(task_id uuid,title text,occurrence_at timestamptz,minutes_before integer,company_id uuid,created_by uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  if window_minutes is null or window_minutes<1 or window_minutes>60 then raise exception 'Invalid reminder window' using errcode='22023';end if;
  return query with pending as (
    select t.id,t.title,t.start_datetime,t.company_id,t.created_by,t.recurrence_type,t.recurrence_value,m.minutes_before,
      public.planning_recurrence_step(t.recurrence_type,t.recurrence_value) step
    from public.planning_task t cross join lateral(select distinct v as minutes_before from unnest(t.reminders) v) m
    where cardinality(t.reminders)>0 and t.start_datetime is not null
      and public.is_company_module_enabled(t.company_id,'planning')
  ), windowed as (
    select p.*,now()-make_interval(mins=>window_minutes)+make_interval(mins=>p.minutes_before) win_from,
      now()+make_interval(mins=>p.minutes_before) win_to from pending p
  ), candidates as (
    select w.id,w.title,w.start_datetime occurrence_at,w.minutes_before,w.company_id,w.created_by
    from windowed w where w.step is null and w.start_datetime between w.win_from and w.win_to
    union all
    select w.id,w.title,public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type),w.minutes_before,w.company_id,w.created_by
    from windowed w cross join lateral generate_series(
      greatest(public.planning_recurrence_index(w.start_datetime,w.win_from,w.recurrence_type,w.recurrence_value)-1,0),
      greatest(public.planning_recurrence_index(w.start_datetime,w.win_to,w.recurrence_type,w.recurrence_value)+1,0)
    ) k(n)
    where w.step is not null and public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type) between w.win_from and w.win_to
  )
  select c.id,c.title,c.occurrence_at,c.minutes_before,c.company_id,c.created_by from candidates c
  where not exists(select 1 from public.planning_reminder_sent s where s.task_id=c.id and s.minutes_before=c.minutes_before and s.occurrence_at=c.occurrence_at);
end $$;
revoke all on function public.due_planning_reminders(integer) from public,anon,authenticated,service_role;
grant execute on function public.due_planning_reminders(integer) to service_role;
notify pgrst,'reload schema';
commit;
