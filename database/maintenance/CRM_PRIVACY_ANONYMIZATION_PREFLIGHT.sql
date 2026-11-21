-- Read-only verification. Returns only function/security flags; no contact data.
select
  exists (
    select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.anonymize_crm_contact(uuid,uuid,uuid)')
  ) as anonymize_rpc_exists,
  coalesce((
    select p.prosecdef and 'row_security=off'=any(p.proconfig)
      and 'search_path=""'=any(p.proconfig)
    from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.anonymize_crm_contact(uuid,uuid,uuid)')
  ),false) as rpc_security_configuration_ok,
  coalesce((
    select pg_catalog.strpos(pg_catalog.pg_get_functiondef(p.oid),'source_item')>0
    from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.anonymize_crm_contact(uuid,uuid,uuid)')
  ),false) as source_item_cleanup_present,
  coalesce((
    select pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      and pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      and not exists (
        select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
        where acl.grantee=0 and acl.privilege_type='EXECUTE'
      )
    from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure('public.anonymize_crm_contact(uuid,uuid,uuid)')
  ),false) as rpc_grants_match_expected_roles;
