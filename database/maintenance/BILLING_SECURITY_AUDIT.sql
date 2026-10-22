-- SOLO LECTURA: ejecutar tras las migraciones de seguridad desde SQL Editor.
-- No devuelve nombres, direcciones, logos ni datos fiscales.

-- 1) RLS y permisos efectivos. anon y authenticated no deben escribir tablas de facturas.
select c.relname as table_name,c.relrowsecurity as rls,
  has_table_privilege('anon',c.oid,'SELECT') as anon_select,
  has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update,
  has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('invoices','quotes','invoice_settings');

-- 2) Políticas vigentes (incluye adjuntos).
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where (schemaname='public' and tablename in
  ('invoices','quotes','invoice_settings','client_company','planning_task','billing'))
  or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;

-- 3) Las referencias cruzadas deben ser cero ANTES de PLANNING_TENANT_HARDENING.sql.
select 'planning_task' as table_name,count(*) as mismatched_tenants
from public.planning_task t join public.client_company c on c.id=t.client_company_id
where t.company_id is distinct from c.company_id
union all
select 'billing',count(*) from public.billing b join public.client_company c on c.id=b.client_company_id
where b.company_id is distinct from c.company_id
union all
select 'quotes_to_invoices',count(*) from public.quotes q join public.invoices i on i.id=q.invoice_id
where q.company_id is distinct from i.company_id;

-- 4) Registros de planning sin tenant: revisar aparte si hay datos históricos.
select 'client_company' as table_name,count(*) as missing_tenant from public.client_company where company_id is null
union all select 'planning_task',count(*) from public.planning_task where company_id is null
union all select 'billing',count(*) from public.billing where company_id is null;

-- 5) Configuración de Storage. El bucket debe existir y public debe ser false.
select id,public from storage.buckets where id='media-planner';

-- 6) Validar documentos históricos, sin modificar ni exponer su contenido.
-- Salida vacía = ningún documento inválido. Usa IDs solo para localizar reparaciones.
-- Ejecutar después de BILLING_SECURITY_HARDENING.sql, como propietario (SQL Editor).
do $$ declare r record; failure text;
begin
  for r in select 'invoice' as kind,id,document from public.invoices
    union all select 'quote',id,document from public.quotes loop
    begin
      perform public.validate_billing_document(r.document);
    exception when others then
      get stacked diagnostics failure = message_text;
      raise notice 'Invalid % id=%: %',r.kind,r.id,failure;
    end;
  end loop;
end $$;

-- 7) Privilegios de RPC: anon=false; authenticated=true solo en las RPC de usuario.
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('save_invoice','save_quote','save_invoice_profile',
  'convert_quote_to_invoice','assert_billing_access','validate_billing_document','validate_billing_profile')
order by p.proname;
