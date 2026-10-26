-- Apply after PLANNING_TENANT_HARDENING.sql. Task moves are optimistic and reversible.
begin;
alter table public.planning_task add column if not exists version integer not null default 1 check(version>0);
alter table public.planning_task add column if not exists end_datetime timestamptz;
create unique index if not exists planning_task_company_id_uq on public.planning_task(company_id,id);
create table if not exists public.planning_task_moves(
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.planning_task(id) on delete cascade,
  before_start timestamptz not null,before_end timestamptz,after_start timestamptz not null,after_end timestamptz,
  version_before integer not null,version_after integer not null,created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),undone_at timestamptz,
  unique(company_id,id),foreign key(company_id,task_id) references public.planning_task(company_id,id) on delete cascade
);
create unique index if not exists planning_task_moves_active_latest_uq on public.planning_task_moves(company_id,task_id,version_after);
alter table public.planning_task_moves enable row level security;
revoke all on public.planning_task_moves from public,anon,authenticated;

create or replace function public.bump_planning_task_version()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.company_id is distinct from old.company_id then raise exception 'Tenant cannot change' using errcode='42501';end if;
  new.version:=old.version+1;
  return new;
end $$;
drop trigger if exists planning_task_version on public.planning_task;
create trigger planning_task_version before update on public.planning_task for each row execute function public.bump_planning_task_version();

create or replace function public.move_planning_task(p_company uuid,p_task uuid,p_version integer,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.planning_task;changed public.planning_task;move_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then raise exception 'Forbidden' using errcode='42501';end if;
  if p_start is null or (p_end is not null and (p_end<=p_start or p_end-p_start>interval '31 days')) then raise exception 'Invalid task duration' using errcode='22023';end if;
  select * into source from public.planning_task where id=p_task and company_id=p_company for update;
  if not found or source.version is distinct from p_version then raise exception 'Task changed; reload' using errcode='40001';end if;
  if source.start_datetime is null then raise exception 'Task cannot be moved' using errcode='22023';end if;
  update public.planning_task set start_datetime=p_start,end_datetime=p_end where id=p_task and company_id=p_company returning * into changed;
  insert into public.planning_task_moves(company_id,task_id,before_start,before_end,after_start,after_end,version_before,version_after,created_by)
    values(p_company,p_task,source.start_datetime,source.end_datetime,changed.start_datetime,changed.end_datetime,source.version,changed.version,auth.uid()) returning id into move_id;
  return jsonb_build_object('task',to_jsonb(changed),'move_id',move_id,'version',changed.version);
end $$;

create or replace function public.undo_planning_task_move(p_company uuid,p_task uuid,p_move uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.planning_task;move public.planning_task_moves;changed public.planning_task;
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then raise exception 'Forbidden' using errcode='42501';end if;
  select * into source from public.planning_task where id=p_task and company_id=p_company for update;
  select * into move from public.planning_task_moves where id=p_move and company_id=p_company and task_id=p_task for update;
  if not found or move.undone_at is not null or source.id is null or source.version is distinct from p_version or source.version<>move.version_after then
    raise exception 'Move can no longer be undone; task changed' using errcode='40001';
  end if;
  update public.planning_task set start_datetime=move.before_start,end_datetime=move.before_end where id=p_task and company_id=p_company returning * into changed;
  update public.planning_task_moves set undone_at=now() where id=p_move and company_id=p_company;
  return jsonb_build_object('task',to_jsonb(changed),'version',changed.version);
end $$;
revoke all on function public.bump_planning_task_version() from public,anon,authenticated;
revoke all on function public.move_planning_task(uuid,uuid,integer,timestamptz,timestamptz) from public,anon;
revoke all on function public.undo_planning_task_move(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.move_planning_task(uuid,uuid,integer,timestamptz,timestamptz) to authenticated;
grant execute on function public.undo_planning_task_move(uuid,uuid,uuid,integer) to authenticated;
commit;
