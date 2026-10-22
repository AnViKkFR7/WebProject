-- Repair old RPC return contracts without changing cron schedules or secrets.
-- Deploy the updated send-planning-reminders Edge Function alongside this change.
begin;
create or replace function public.planning_recurrence_step(_type text, _value integer)
returns interval
language sql
immutable
as $$
  select case _type
    when 'hourly' then make_interval(hours => greatest(coalesce(_value, 1), 1))
    when 'daily'  then make_interval(days  => greatest(coalesce(_value, 1), 1))
    when 'weekly' then make_interval(weeks => greatest(coalesce(_value, 1), 1))
    when 'yearly' then make_interval(years => greatest(coalesce(_value, 1), 1))
    else null
  end;
$$;

create or replace function public.planning_occurrence_at(_start timestamptz,_step interval,_n bigint,_type text)
returns timestamptz language sql immutable set search_path=pg_catalog as $$
  select case when _type='hourly' then _start+(_n*_step)
    else ((_start at time zone 'Europe/Madrid')+(_n*_step)) at time zone 'Europe/Madrid' end;
$$;
drop function if exists public.due_planning_reminders(integer);
create or replace function public.due_planning_reminders(window_minutes integer default 10)
returns table (
  task_id uuid,
  title text,
  occurrence_at timestamptz,
  minutes_before integer,
  company_id uuid,
  created_by uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with pending as (
    select t.id, t.title, t.start_datetime, t.company_id, t.created_by,t.recurrence_type,
           m.minutes_before,
           public.planning_recurrence_step(t.recurrence_type, t.recurrence_value) as step
    from public.planning_task t
    cross join unnest(t.reminders) as m(minutes_before)
    where cardinality(t.reminders) > 0
  ),
  -- Ventana en la que debe caer la ocurrencia para que toque avisar ahora
  windowed as (
    select p.*,
           now() - make_interval(mins => window_minutes) + make_interval(mins => p.minutes_before) as win_from,
           now() + make_interval(mins => p.minutes_before) as win_to
    from pending p
  ),
  candidates as (
    -- Tareas que no se repiten: su única fecha
    select w.id, w.title, w.start_datetime as occurrence_at,
           w.minutes_before, w.company_id, w.created_by
    from windowed w
    where w.step is null
      and w.start_datetime between w.win_from and w.win_to

    union all

    -- Tareas que se repiten: se estima qué repetición cae en la ventana y se
    -- comprueban tres candidatas alrededor, por si la estimación se desvía
    -- (el paso 'yearly' no dura siempre lo mismo).
    select w.id, w.title, public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type),
           w.minutes_before, w.company_id, w.created_by
    from windowed w
    cross join lateral (
      select generate_series(
        greatest(
          floor(extract(epoch from (w.win_from - w.start_datetime))
                / nullif(extract(epoch from w.step), 0))::bigint - 1,
          0),
        greatest(
          floor(extract(epoch from (w.win_from - w.start_datetime))
                / nullif(extract(epoch from w.step), 0))::bigint + 1,
          0)
      ) as n
    ) k
    where w.step is not null
      and k.n <= 200                                   -- mismo tope que el panel
      and public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type) between w.win_from and w.win_to
      and public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type) <= now() + interval '3 years'
  )
  select c.id, c.title, c.occurrence_at, c.minutes_before, c.company_id, c.created_by
  from candidates c
  where not exists (
    select 1 from public.planning_reminder_sent s
    where s.task_id = c.id
      and s.minutes_before = c.minutes_before
      and s.occurrence_at = c.occurrence_at
  );
$$;

-- Nadie la llama desde el panel: solo el cron, con la service role key.
-- OJO: 'revoke ... from public' se lo quita a TODOS los roles, service_role
-- incluido, así que hay que volver a dárselo explícitamente o la función
-- falla con "permission denied for function".
revoke all on function public.due_planning_reminders(integer) from public, anon, authenticated;
grant execute on function public.due_planning_reminders(integer) to service_role;


notify pgrst, 'reload schema';
commit;
