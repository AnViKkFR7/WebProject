-- Read-only check for the quote approval migration in Supabase.
-- Returns object/permission flags only; no quote or customer data is read.
with required_columns(table_name, column_name) as (
  values
    ('quote_approval_links','company_id'),
    ('quote_approval_links','quote_id'),
    ('quote_approval_links','token_hash'),
    ('quote_approval_links','expires_at'),
    ('quote_approval_links','issued_at'),
    ('quote_approval_links','issued_by'),
    ('quote_approval_links','revoked_at'),
    ('quote_approval_links','resolved_at'),
    ('quote_approval_links','email_sent_at'),
    ('quote_approval_links','email_provider_id'),
    ('quote_approval_links','company_notified_at'),
    ('quote_approval_links','company_notification_provider_id'),
    ('quote_approval_responses','company_id'),
    ('quote_approval_responses','quote_id'),
    ('quote_approval_responses','link_id'),
    ('quote_approval_responses','decision'),
    ('quote_approval_responses','declared_name'),
    ('quote_approval_responses','declared_email'),
    ('quote_approval_responses','reason'),
    ('quote_approval_responses','responded_at')
), required_functions(signature) as (
  values
    ('public.issue_quote_approval_link(uuid,uuid,text,timestamp with time zone)'),
    ('public.get_quote_approval_details(text)'),
    ('public.respond_to_quote_approval(text,text,text,text,text)'),
    ('public.get_quote_approval_audit(uuid,uuid)'),
    ('public.assert_quote_approval_module(uuid)'),
    ('public.revoke_stale_quote_approval_links()'),
    ('public.get_quote_approval_email_payload(uuid,uuid,uuid,text)'),
    ('public.mark_quote_approval_email_sent(uuid,uuid,uuid,uuid,text)'),
    ('public.get_company_recent_quote_approval_responses(uuid,integer)'),
    ('public.get_quote_approval_notification_payload(text)'),
    ('public.mark_quote_approval_notification_sent(uuid,text)')
), objects as (
  select
    pg_catalog.to_regclass('public.quotes') as quotes_oid,
    pg_catalog.to_regclass('public.quote_approval_links') as links_oid,
    pg_catalog.to_regclass('public.quote_approval_responses') as responses_oid
)
select
  quotes_oid is not null as quotes_table_exists,
  links_oid is not null as approval_links_table_exists,
  responses_oid is not null as approval_responses_table_exists,
  coalesce((
    select pg_catalog.bool_and(exists(
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid=pg_catalog.to_regclass('public.'||r.table_name)
        and a.attname=r.column_name and a.attnum>0 and not a.attisdropped
    )) from required_columns r
  ),false) as required_columns_present,
  exists(select 1 from pg_catalog.pg_indexes where schemaname='public' and indexname='quotes_company_id_id_unique') as quote_tenant_key_index_exists,
  exists(select 1 from pg_catalog.pg_indexes where schemaname='public' and indexname='quote_approval_one_active_per_quote') as single_active_link_index_exists,
  exists(select 1 from pg_catalog.pg_indexes where schemaname='public' and indexname='quote_approval_links_expiry_idx') as expiry_index_exists,
  exists(select 1 from pg_catalog.pg_trigger where tgrelid=quotes_oid and tgname='quotes_revoke_stale_approval_links' and not tgisinternal and tgenabled<>'D') as quote_link_revocation_trigger_exists,
  coalesce((select pg_catalog.bool_and(exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=links_oid and a.attname=c.column_name and a.attnum>0 and not a.attisdropped))
    from (values('email_sent_at'),('email_provider_id')) c(column_name)),false) as quote_link_email_tracking_columns_present,
  coalesce((select pg_catalog.bool_and(exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=links_oid and a.attname=c.column_name and a.attnum>0 and not a.attisdropped))
    from (values('company_notified_at'),('company_notification_provider_id')) c(column_name)),false) as response_notification_tracking_columns_present,
  coalesce((
    select pg_catalog.bool_and(p.oid is not null)
    from required_functions f left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(f.signature)
  ),false) as required_functions_present,
  coalesce((
    select pg_catalog.bool_and(p.prosecdef)
    from required_functions f join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(f.signature)
  ),false) as rpc_security_definer_enabled,
  coalesce((
    select pg_catalog.bool_and(c.relrowsecurity)
    from (values(links_oid),(responses_oid)) t(oid)
    join pg_catalog.pg_class c on c.oid=t.oid
  ),false) as rls_enabled_on_private_tables,
  coalesce((
    select pg_catalog.bool_and(not has_table_privilege(r.rolname,t.oid,p.privilege))
    from (values('anon'),('authenticated')) r(rolname)
    cross join (values(links_oid),(responses_oid)) t(oid)
    cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(privilege)
  ),false) as direct_table_access_revoked,
  coalesce(has_function_privilege('anon',pg_catalog.to_regprocedure('public.get_quote_approval_details(text)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('anon',pg_catalog.to_regprocedure('public.respond_to_quote_approval(text,text,text,text,text)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',pg_catalog.to_regprocedure('public.issue_quote_approval_link(uuid,uuid,text,timestamp with time zone)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',pg_catalog.to_regprocedure('public.get_quote_approval_audit(uuid,uuid)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.issue_quote_approval_link(uuid,uuid,text,timestamp with time zone)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.get_quote_approval_details(text)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.respond_to_quote_approval(text,text,text,text,text)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.get_quote_approval_audit(uuid,uuid)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.get_quote_approval_email_payload(uuid,uuid,uuid,text)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.mark_quote_approval_email_sent(uuid,uuid,uuid,uuid,text)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.get_company_recent_quote_approval_responses(uuid,integer)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',pg_catalog.to_regprocedure('public.get_quote_approval_email_payload(uuid,uuid,uuid,text)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',pg_catalog.to_regprocedure('public.get_company_recent_quote_approval_responses(uuid,integer)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',pg_catalog.to_regprocedure('public.get_quote_approval_notification_payload(text)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('authenticated',pg_catalog.to_regprocedure('public.get_quote_approval_notification_payload(text)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('service_role',pg_catalog.to_regprocedure('public.get_quote_approval_notification_payload(text)'),'EXECUTE'),false)
    and coalesce(has_function_privilege('service_role',pg_catalog.to_regprocedure('public.mark_quote_approval_notification_sent(uuid,text)'),'EXECUTE'),false)
    as rpc_grants_match_expected_roles
from objects;
