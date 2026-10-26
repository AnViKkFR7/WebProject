-- Read-only check for CRM_LEAD_ITEM_ATTRIBUTION.sql.
select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='lead' and column_name='source_item'
  ) as lead_source_item_present,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='crm_contacts' and column_name='source_item'
  ) as contact_source_item_present,
  exists(
    select 1 from pg_trigger
    where tgrelid='public.lead'::regclass
      and tgname='zz_sync_crm_lead_source_item'
      and not tgisinternal
  ) as source_item_sync_trigger_present,
  exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='sync_crm_lead_source_item'
      and p.prosecdef
  ) as source_item_sync_function_is_security_definer;
