-- Clears the item attribution added after the original anonymization RPC.
-- Apply after CRM_BILLING_LINKS.sql and CRM_LEAD_ITEM_ATTRIBUTION.sql.
begin;

create or replace function public.anonymize_crm_contact(p_company uuid,p_contact uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb; lead_count integer; activity_count integer; billing_document_count integer;
begin
  perform public.assert_crm_privacy_admin(p_company);
  if p_request is null then raise exception 'Request ID required' using errcode='22023'; end if;
  select affected_counts into result from public.crm_privacy_audit where company_id=p_company and request_id=p_request and action='anonymize';
  if found then return result||pg_catalog.jsonb_build_object('already_applied',true); end if;
  perform 1 from public.crm_contacts where company_id=p_company and id=p_contact for update;
  if not found then raise exception 'Contact not found' using errcode='P0002'; end if;

  select count(*)::integer into lead_count from public.lead where company_id=p_company and crm_contact_id=p_contact;
  select count(*)::integer into activity_count from public.crm_activities where company_id=p_company and contact_id=p_contact;
  select count(*)::integer into billing_document_count from public.crm_billing_links where company_id=p_company and contact_id=p_contact;

  perform pg_catalog.set_config('app.crm_privacy_erasure','on',true);
  delete from public.crm_activities where company_id=p_company and contact_id=p_contact;
  update public.lead set name='Contacto anonimizado',email=null,phone=null,message=null,notes=null,
    source_path=null,source_item=null,source_referrer=null,source_campaign=null,
    source_utm_source=null,source_utm_medium=null,source_utm_term=null,source_utm_content=null,
    consent_given=false,consent_at=null,consent_text_version=null,consent_source=null,
    crm_contact_id=null,crm_stage_id=null,crm_match_state='anonymized'
    where company_id=p_company and crm_contact_id=p_contact;
  delete from public.crm_billing_links where company_id=p_company and contact_id=p_contact;
  delete from public.crm_contacts where company_id=p_company and id=p_contact;

  result:=pg_catalog.jsonb_build_object('lead_count',lead_count,'activity_count',activity_count,
    'billing_document_count',billing_document_count,'anonymized',true,'already_applied',false);
  insert into public.crm_privacy_audit(company_id,request_id,action,affected_counts,performed_by)
    values(p_company,p_request,'anonymize',result,auth.uid());
  return result;
end $$;

revoke all on function public.anonymize_crm_contact(uuid,uuid,uuid) from public,anon;
grant execute on function public.anonymize_crm_contact(uuid,uuid,uuid) to authenticated,service_role;

commit;
