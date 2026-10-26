-- Company-configured CRM retention review thresholds. This migration records
-- periods and review counts only; it never deletes or anonymizes records.
begin;

create table if not exists public.crm_retention_review_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  unresolved_lead_days integer check(unresolved_lead_days between 1 and 3650),
  inactive_contact_days integer check(inactive_contact_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.crm_retention_review_settings enable row level security;
revoke all on public.crm_retention_review_settings from public,anon,authenticated;

create or replace function public.get_crm_retention_review(p_company uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare settings public.crm_retention_review_settings%rowtype;
  overdue_leads integer := 0;
  inactive_contacts integer := 0;
begin
  perform public.assert_crm_privacy_admin(p_company);
  select * into settings from public.crm_retention_review_settings where company_id=p_company;

  if settings.unresolved_lead_days is not null then
    select count(*)::integer into overdue_leads
    from public.lead l
    where l.company_id=p_company and l.crm_match_state='review_required'
      and l.created_at <= now() - settings.unresolved_lead_days * interval '1 day';
  end if;

  if settings.inactive_contact_days is not null then
    select count(*)::integer into inactive_contacts
    from public.crm_contacts c
    where c.company_id=p_company
      and (c.next_follow_up_at is null or c.next_follow_up_at <= now())
      and greatest(
        c.created_at,
        coalesce((select max(a.occurred_at) from public.crm_activities a where a.company_id=c.company_id and a.contact_id=c.id),c.created_at),
        coalesce((select max(link.linked_at) from public.crm_billing_links link where link.company_id=c.company_id and link.contact_id=c.id),c.created_at)
      ) <= now() - settings.inactive_contact_days * interval '1 day';
  end if;

  return pg_catalog.jsonb_build_object(
    'unresolved_lead_days',settings.unresolved_lead_days,
    'inactive_contact_days',settings.inactive_contact_days,
    'unresolved_leads_for_review',overdue_leads,
    'inactive_contacts_for_review',inactive_contacts,
    'updated_at',settings.updated_at
  );
end;
$$;

create or replace function public.save_crm_retention_review_settings(
  p_company uuid,
  p_unresolved_lead_days integer,
  p_inactive_contact_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  perform public.assert_crm_privacy_admin(p_company);
  if (p_unresolved_lead_days is not null and p_unresolved_lead_days not between 1 and 3650)
    or (p_inactive_contact_days is not null and p_inactive_contact_days not between 1 and 3650) then
    raise exception 'Retention review periods must be between 1 and 3650 days' using errcode='22023';
  end if;

  insert into public.crm_retention_review_settings(company_id,unresolved_lead_days,inactive_contact_days,updated_at,updated_by)
  values(p_company,p_unresolved_lead_days,p_inactive_contact_days,now(),auth.uid())
  on conflict(company_id) do update set
    unresolved_lead_days=excluded.unresolved_lead_days,
    inactive_contact_days=excluded.inactive_contact_days,
    updated_at=excluded.updated_at,
    updated_by=excluded.updated_by;

  return public.get_crm_retention_review(p_company);
end;
$$;

revoke all on function public.get_crm_retention_review(uuid),public.save_crm_retention_review_settings(uuid,integer,integer) from public,anon,service_role;
grant execute on function public.get_crm_retention_review(uuid),public.save_crm_retention_review_settings(uuid,integer,integer) to authenticated;

commit;
