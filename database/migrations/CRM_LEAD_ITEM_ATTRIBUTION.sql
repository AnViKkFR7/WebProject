-- Captures the public item that led to a contact request, when the client site
-- can provide its display name, slug, or stable ID.
-- Apply after CRM_CONTACTS_PIPELINE.sql. Safe to rerun.
begin;

alter table public.lead
  add column if not exists source_item text;

alter table public.crm_contacts
  add column if not exists source_item text;

create or replace function public.sync_crm_lead_source_item()
returns trigger
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
begin
  if new.crm_match_state <> 'anonymized'
    and new.crm_contact_id is not null
    and nullif(pg_catalog.btrim(new.source_item), '') is not null then
    update public.crm_contacts
      set source_item=pg_catalog.left(pg_catalog.btrim(new.source_item),200)
      where company_id=new.company_id
        and id=new.crm_contact_id
        and source_item is null;
  end if;
  return new;
end
$$;

create or replace function public.clear_crm_lead_item_on_anonymization()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.crm_match_state='anonymized' then
    new.source_item:=null;
  end if;
  return new;
end
$$;

drop trigger if exists crm_clear_lead_item_on_anonymization on public.lead;
create trigger crm_clear_lead_item_on_anonymization
before update of crm_match_state,source_item
on public.lead
for each row execute function public.clear_crm_lead_item_on_anonymization();

drop trigger if exists zz_sync_crm_lead_source_item on public.lead;
create trigger zz_sync_crm_lead_source_item
after insert or update of crm_contact_id,source_item
on public.lead
for each row execute function public.sync_crm_lead_source_item();

revoke all on function public.sync_crm_lead_source_item() from public,anon,authenticated;
revoke all on function public.clear_crm_lead_item_on_anonymization() from public,anon,authenticated;

commit;
