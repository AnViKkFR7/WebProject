-- Preserve the original request on the selected contact when an ambiguous
-- lead is explicitly resolved by an authorized CRM user.
create or replace function public.capture_resolved_crm_lead_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.crm_match_state = 'review_required'
    and new.crm_match_state = 'linked'
    and new.crm_contact_id is not null
  then
    insert into public.crm_activities(
      company_id, contact_id, lead_id, kind, title, details, occurred_at
    )
    select new.company_id, new.crm_contact_id, new.id, 'form', 'Solicitud recibida',
      new.message, new.created_at
    where not exists (
      select 1
      from public.crm_activities activity
      where activity.company_id = new.company_id
        and activity.contact_id = new.crm_contact_id
        and activity.lead_id = new.id
        and activity.kind = 'form'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.capture_resolved_crm_lead_activity() from public, anon, authenticated;

drop trigger if exists lead_capture_resolved_crm_activity on public.lead;
create trigger lead_capture_resolved_crm_activity
after update of crm_match_state, crm_contact_id on public.lead
for each row execute function public.capture_resolved_crm_lead_activity();
