-- The weekly summary is automatic: no user-facing settings page or opt-in toggle.
-- Send to active company administrators every Monday at 09:00 Madrid time.
begin;

alter table public.company_weekly_summary_settings
  alter column enabled set default true,
  alter column local_send_time set default time '09:00';

insert into public.company_weekly_summary_settings(company_id,enabled,local_send_time)
select c.id,true,time '09:00'
from public.companies c
on conflict(company_id) do update set
  enabled=true,
  local_send_time=time '09:00',
  updated_at=pg_catalog.now();

create or replace function public.initialize_company_weekly_summary_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into public.company_weekly_summary_settings(company_id,enabled,local_send_time)
  values(new.id,true,time '09:00')
  on conflict(company_id) do nothing;
  return new;
end;
$$;

drop trigger if exists companies_initialize_weekly_summary on public.companies;
create trigger companies_initialize_weekly_summary
after insert on public.companies
for each row execute function public.initialize_company_weekly_summary_settings();

alter table public.company_weekly_summary_settings enable row level security;
drop policy if exists weekly_summary_settings_read on public.company_weekly_summary_settings;
revoke all on public.company_weekly_summary_settings from public,anon,authenticated;
drop policy if exists weekly_summary_queue_read on public.company_weekly_summary_queue;
revoke all on public.company_weekly_summary_queue from public,anon,authenticated;

drop function if exists public.get_company_weekly_summary_settings(uuid);
drop function if exists public.save_company_weekly_summary_settings(uuid,boolean,time);
revoke all on function public.initialize_company_weekly_summary_settings() from public,anon,authenticated;

commit;
