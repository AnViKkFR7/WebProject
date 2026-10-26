-- Read-only check before applying CRM_REVIEW_ACTIVITY_LINK.sql or
-- CRM_RETENTION_REVIEW.sql. Returns object/permission state only; no PII.
with state as (
  select
    to_regclass('public.lead') as lead_table,
    to_regclass('public.crm_contacts') as contacts_table,
    to_regclass('public.crm_activities') as activities_table,
    to_regclass('public.crm_billing_links') as billing_links_table,
    to_regclass('public.crm_retention_review_settings') as retention_table,
    to_regprocedure('public.assert_crm_privacy_admin(uuid)') as privacy_admin_fn,
    to_regprocedure('public.capture_resolved_crm_lead_activity()') as capture_review_fn,
    to_regprocedure('public.get_crm_retention_review(uuid)') as retention_get_fn,
    to_regprocedure('public.save_crm_retention_review_settings(uuid,integer,integer)') as retention_save_fn
)
select
  lead_table is not null as lead_table_exists,
  case when lead_table is null then false else (
    select count(*)=5 from pg_catalog.pg_attribute a
    where a.attrelid=lead_table and a.attname in ('company_id','crm_match_state','crm_contact_id','message','created_at') and a.attnum>0 and not a.attisdropped
  ) end as lead_crm_columns_present,
  contacts_table is not null as crm_contacts_exists,
  case when contacts_table is null then false else (
    select count(*)=3 from pg_catalog.pg_attribute a
    where a.attrelid=contacts_table and a.attname in ('company_id','created_at','next_follow_up_at') and a.attnum>0 and not a.attisdropped
  ) end as crm_contact_review_columns_present,
  activities_table is not null as crm_activities_exists,
  case when activities_table is null then false else (
    select count(*)=4 from pg_catalog.pg_attribute a
    where a.attrelid=activities_table and a.attname in ('company_id','contact_id','lead_id','occurred_at') and a.attnum>0 and not a.attisdropped
  ) end as crm_activity_columns_present,
  billing_links_table is not null as crm_billing_links_exists,
  case when billing_links_table is null then false else (
    select count(*)=3 from pg_catalog.pg_attribute a
    where a.attrelid=billing_links_table and a.attname in ('company_id','contact_id','linked_at') and a.attnum>0 and not a.attisdropped
  ) end as crm_billing_link_review_columns_present,
  privacy_admin_fn is not null as crm_privacy_admin_rpc_exists,
  capture_review_fn is not null as crm_review_activity_function_exists,
  case when lead_table is null then false else exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid=lead_table and t.tgname='lead_capture_resolved_crm_activity' and not t.tgisinternal
  ) end as crm_review_activity_trigger_exists,
  retention_table is not null as crm_retention_settings_table_exists,
  case when retention_table is null then false else coalesce((
    select c.relrowsecurity from pg_catalog.pg_class c where c.oid=retention_table
  ),false) end as crm_retention_rls_enabled,
  retention_get_fn is not null as crm_retention_get_rpc_exists,
  retention_save_fn is not null as crm_retention_save_rpc_exists,
  case when retention_table is null then false else not pg_catalog.has_table_privilege('authenticated',retention_table,'SELECT') end as crm_retention_direct_select_denied,
  case when retention_get_fn is null then false else pg_catalog.has_function_privilege('authenticated',retention_get_fn,'EXECUTE') end as crm_retention_get_rpc_granted
from state;
