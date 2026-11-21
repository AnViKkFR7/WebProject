-- Read-only checks for late billing RPCs protected by COMPANY_MODULES_SCOPE_FIX.sql.
-- Returns security flags only; it does not read tenant data or change settings.
with guarded_rpcs(signature,expected_auth,expected_service) as (
  values
    ('public.get_company_customer_email_settings(uuid)',true,true),
    ('public.save_company_customer_email_settings(uuid,jsonb)',true,true),
    ('public.get_company_customer_email_revisions(uuid)',true,true),
    ('public.restore_company_customer_email_revision(uuid,uuid)',true,true),
    ('public.get_company_customer_email_template(uuid,text,text,uuid)',true,true),
    ('public.get_quote_approval_audit(uuid,uuid)',true,true),
    ('public.get_quote_approval_notification_payload(text)',false,true)
),
private_rpcs(signature) as (
  values
    ('public.get_company_customer_email_settings_unchecked(uuid)'),
    ('public.save_company_customer_email_settings_unchecked(uuid,jsonb)'),
    ('public.get_company_customer_email_revisions_unchecked(uuid)'),
    ('public.restore_company_customer_email_revision_unchecked(uuid,uuid)'),
    ('public.get_company_customer_email_template_unchecked(uuid,text,text,uuid)'),
    ('public.get_quote_approval_audit_unchecked(uuid,uuid)'),
    ('public.get_quote_approval_notification_payload_unchecked(text)')
),
module_helper as (
  select p.* from pg_catalog.pg_proc p
  where p.oid=pg_catalog.to_regprocedure('public.assert_company_module_enabled(uuid,text)')
)
select
  exists(select 1 from module_helper) as module_guard_exists,
  coalesce((select prosecdef and 'row_security=off'=any(proconfig) and 'search_path=""'=any(proconfig)
    from module_helper),false) as module_guard_security_config_ok,
  coalesce((select not pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('anon',oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('service_role',oid,'EXECUTE')
      and not exists(select 1 from pg_catalog.aclexplode(coalesce(proacl,pg_catalog.acldefault('f',proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
    from module_helper),false) as module_guard_not_public,
  (select count(*)=7 and bool_and(
      p.prosecdef and 'row_security=off'=any(p.proconfig) and 'search_path=""'=any(p.proconfig)
      and pg_catalog.strpos(pg_catalog.pg_get_functiondef(p.oid),'assert_company_module_enabled')>0
      and case when g.expected_auth then pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') else not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') end
      and case when g.expected_service then pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') else not pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') end
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      and not exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
    ) from guarded_rpcs g join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(g.signature)) as late_billing_rpcs_guarded,
  coalesce((select bool_and(
      not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
    ) from private_rpcs r join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(r.signature)),true) as unchecked_rpcs_private,
  (select bool_and(
      not pg_catalog.has_table_privilege('authenticated',format('public.%I',table_name),'SELECT')
      and not pg_catalog.has_table_privilege('authenticated',format('public.%I',table_name),'INSERT')
      and not pg_catalog.has_table_privilege('authenticated',format('public.%I',table_name),'UPDATE')
      and not pg_catalog.has_table_privilege('authenticated',format('public.%I',table_name),'DELETE')
      and not pg_catalog.has_table_privilege('anon',format('public.%I',table_name),'SELECT')
      and not pg_catalog.has_table_privilege('anon',format('public.%I',table_name),'INSERT')
      and not pg_catalog.has_table_privilege('anon',format('public.%I',table_name),'UPDATE')
      and not pg_catalog.has_table_privilege('anon',format('public.%I',table_name),'DELETE')
      and not exists(select 1 from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid=c.relnamespace
        cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
        where n.nspname='public' and c.relname=table_name and a.grantee=0 and a.privilege_type in('SELECT','INSERT','UPDATE','DELETE'))
    )
    from unnest(array['company_customer_email_settings','company_customer_email_revisions','quote_approval_links','quote_approval_responses','quote_approval_response_handling']) table_name) as private_billing_tables_isolated,
  (not pg_catalog.has_table_privilege('authenticated','public.company_modules','UPDATE')
    and pg_catalog.has_function_privilege('authenticated','public.set_company_module(uuid,text,boolean)','EXECUTE')) as module_configuration_system_admin_rpc_only;
