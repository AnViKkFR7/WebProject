-- Export and anonymization for a contact's CRM data. Apply after CRM_CONTACTS_PIPELINE.sql.
-- Billing documents are deliberately not changed by this operation.
begin;

alter table public.lead drop constraint if exists lead_crm_match_state_check;
alter table public.lead add constraint lead_crm_match_state_check
  check (crm_match_state in ('unprocessed','linked','review_required','anonymized'));

create table if not exists public.crm_privacy_audit (
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null,
  action text not null check(action in ('anonymize')),
  affected_counts jsonb not null default '{}'::jsonb,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(company_id,request_id)
);
alter table public.crm_privacy_audit enable row level security;
revoke all on public.crm_privacy_audit from public,anon,authenticated;

create or replace function public.assert_crm_privacy_admin(p_company uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
end $$;

create or replace function public.list_crm_privacy_contacts(p_company uuid,p_query text)
returns table(id uuid,name text,email text,phone text,created_at timestamptz)
language plpgsql security definer set search_path='' set row_security=off as $$
declare needle text;
begin
  perform public.assert_crm_privacy_admin(p_company);
  needle:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_query,'')));
  if pg_catalog.char_length(needle)<2 then return; end if;
  return query select c.id,c.name,c.email,c.phone,c.created_at
    from public.crm_contacts c where c.company_id=p_company and (
      pg_catalog.lower(c.name) like '%'||needle||'%' escape '\' or
      pg_catalog.lower(coalesce(c.email,'')) like '%'||needle||'%' escape '\' or
      pg_catalog.regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') like '%'||pg_catalog.regexp_replace(needle,'[^0-9]','','g')||'%' escape '\'
    ) order by c.updated_at desc,c.id limit 100;
end $$;

create or replace function public.preview_crm_contact_anonymization(p_company uuid,p_contact uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb;
begin
  perform public.assert_crm_privacy_admin(p_company);
  if not exists(select 1 from public.crm_contacts where company_id=p_company and id=p_contact) then
    raise exception 'Contact not found' using errcode='P0002';
  end if;
  select pg_catalog.jsonb_build_object(
    'lead_count',(select pg_catalog.count(*) from public.lead where company_id=p_company and crm_contact_id=p_contact),
    'activity_count',(select pg_catalog.count(*) from public.crm_activities where company_id=p_company and contact_id=p_contact)
  ) into result;
  return result;
end $$;

create or replace function public.export_crm_contact(p_company uuid,p_contact uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare contact_row public.crm_contacts; result jsonb;
begin
  perform public.assert_crm_privacy_admin(p_company);
  select * into contact_row from public.crm_contacts where company_id=p_company and id=p_contact;
  if not found then raise exception 'Contact not found' using errcode='P0002'; end if;
  select pg_catalog.jsonb_build_object(
    'schema_version',1,
    'exported_at',pg_catalog.now(),
    'contact',pg_catalog.to_jsonb(contact_row),
    'requests',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.created_at,l.id)
      from public.lead l where l.company_id=p_company and l.crm_contact_id=p_contact),'[]'::jsonb),
    'activities',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) order by a.occurred_at,a.id)
      from public.crm_activities a where a.company_id=p_company and a.contact_id=p_contact),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.anonymize_crm_contact(p_company uuid,p_contact uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb; lead_count integer; activity_count integer;
begin
  perform public.assert_crm_privacy_admin(p_company);
  if p_request is null then raise exception 'Request ID required' using errcode='22023'; end if;
  select affected_counts into result from public.crm_privacy_audit
    where company_id=p_company and request_id=p_request and action='anonymize';
  if found then return result||pg_catalog.jsonb_build_object('already_applied',true); end if;
  perform 1 from public.crm_contacts where company_id=p_company and id=p_contact for update;
  if not found then raise exception 'Contact not found' using errcode='P0002'; end if;

  select pg_catalog.count(*)::integer into lead_count from public.lead where company_id=p_company and crm_contact_id=p_contact;
  select pg_catalog.count(*)::integer into activity_count from public.crm_activities where company_id=p_company and contact_id=p_contact;

  -- The module may be disabled, but a verified privacy operation must remain possible.
  perform pg_catalog.set_config('app.crm_privacy_erasure','on',true);
  delete from public.crm_activities where company_id=p_company and contact_id=p_contact;
  update public.lead set
    name='Contacto anonimizado',email=null,phone=null,message=null,notes=null,
    source_path=null,source_referrer=null,source_campaign=null,
    source_utm_source=null,source_utm_medium=null,source_utm_term=null,source_utm_content=null,
    consent_given=false,consent_at=null,consent_text_version=null,consent_source=null,
    crm_contact_id=null,crm_stage_id=null,crm_match_state='anonymized'
    where company_id=p_company and crm_contact_id=p_contact;
  delete from public.crm_contacts where company_id=p_company and id=p_contact;

  result:=pg_catalog.jsonb_build_object('lead_count',lead_count,'activity_count',activity_count,'anonymized',true,'already_applied',false);
  insert into public.crm_privacy_audit(company_id,request_id,action,affected_counts,performed_by)
    values(p_company,p_request,'anonymize',result,auth.uid());
  return result;
end $$;

revoke all on function public.assert_crm_privacy_admin(uuid) from public,anon,authenticated;
revoke all on function public.list_crm_privacy_contacts(uuid,text),public.preview_crm_contact_anonymization(uuid,uuid),public.export_crm_contact(uuid,uuid),public.anonymize_crm_contact(uuid,uuid,uuid) from public,anon;
grant execute on function public.list_crm_privacy_contacts(uuid,text),public.preview_crm_contact_anonymization(uuid,uuid),public.export_crm_contact(uuid,uuid),public.anonymize_crm_contact(uuid,uuid,uuid) to authenticated,service_role;
commit;
