-- Clientes y colaboradores, cada uno como persona física o empresa, con su ficha y resumen.
-- Aplicar después de CLIENT_DIRECTORY_MODULE_ACCESS.sql, BILLING_PAYMENTS_HISTORY.sql y
-- BILLING_RECTIFYING_INVOICES.sql. Una sola vez; no reescribe migraciones anteriores.
--
-- Modelo (inspirado en Odoo res.partner y Salesforce Person/Business Accounts):
--   * Un único directorio por empresa (client_company): la misma ficha puede ser cliente,
--     colaborador o ambas cosas, sin duplicar datos ni romper referencias de tareas y movimientos.
--   * legal_form distingue persona física (NIF/DNI, sin persona de contacto) de empresa
--     (CIF, razón social y persona de contacto).
-- Las filas existentes pasan a ser «cliente / empresa», que es lo que eran.
begin;

alter table public.client_company
  add column if not exists legal_form text not null default 'company',
  add column if not exists is_client boolean not null default true,
  add column if not exists is_collaborator boolean not null default false,
  add column if not exists collaborator_role text,
  add column if not exists notes text;

alter table public.client_company drop constraint if exists client_company_legal_form_check;
alter table public.client_company add constraint client_company_legal_form_check check (legal_form in ('company','individual'));
alter table public.client_company drop constraint if exists client_company_relationship_check;
alter table public.client_company add constraint client_company_relationship_check check (is_client or is_collaborator);
alter table public.client_company drop constraint if exists client_company_profile_lengths;
alter table public.client_company add constraint client_company_profile_lengths
  check (coalesce(length(collaborator_role),0) <= 120 and coalesce(length(notes),0) <= 4000);

create index if not exists client_company_directory_idx on public.client_company(company_id, name) where archived_at is null;

-- Alta y edición. Mismas comprobaciones que save_client_company (rol admin/editor y módulo de
-- agenda o facturación activo), más los campos nuevos. Los datos llegan como objeto JSON para
-- poder ampliar la ficha sin cambiar la firma.
create or replace function public.save_directory_party(p_company uuid, p_id uuid, p_party jsonb)
returns public.client_company language plpgsql security definer set search_path='' as $$
declare
  result public.client_company;
  v_name text; v_tax text; v_address text; v_email text; v_phone text; v_responsible text;
  v_color text; v_form text; v_client boolean; v_collaborator boolean; v_role text; v_notes text;
begin
  perform public.assert_client_directory_access(p_company);
  if p_party is null or pg_catalog.jsonb_typeof(p_party) <> 'object'
    or (p_party ? 'is_client' and pg_catalog.jsonb_typeof(p_party->'is_client') <> 'boolean')
    or (p_party ? 'is_collaborator' and pg_catalog.jsonb_typeof(p_party->'is_collaborator') <> 'boolean') then
    raise exception 'Invalid directory data' using errcode='22023';
  end if;
  v_name:=btrim(coalesce(p_party->>'name',''));
  v_tax:=btrim(coalesce(p_party->>'tax_id',''));
  v_address:=btrim(coalesce(p_party->>'billing_address',''));
  v_email:=btrim(coalesce(p_party->>'email',''));
  v_phone:=btrim(coalesce(p_party->>'phone',''));
  v_responsible:=btrim(coalesce(p_party->>'responsible',''));
  v_color:=btrim(coalesce(p_party->>'color',''));
  v_form:=coalesce(nullif(p_party->>'legal_form',''),'company');
  v_client:=coalesce((p_party->>'is_client')::boolean,true);
  v_collaborator:=coalesce((p_party->>'is_collaborator')::boolean,false);
  v_role:=btrim(coalesce(p_party->>'collaborator_role',''));
  v_notes:=btrim(coalesce(p_party->>'notes',''));
  if v_form not in ('company','individual') or not (v_client or v_collaborator)
    or length(v_name) not between 1 and 300 or length(v_tax)>100 or length(v_address)>2000 or length(v_email)>320
    or length(v_phone)>100 or length(v_responsible)>300 or length(v_role)>120 or length(v_notes)>4000
    or (v_color<>'' and v_color !~ '^#[0-9A-Fa-f]{6}$') then
    raise exception 'Invalid directory data' using errcode='22023';
  end if;
  -- Una persona física es su propio contacto; la especialidad solo aplica a colaboradores.
  if v_form='individual' then v_responsible:=''; end if;
  if not v_collaborator then v_role:=''; end if;

  if p_id is null then
    insert into public.client_company(company_id,user_id,name,tax_id,billing_address,email,phone,responsible,color,updated_by,
      legal_form,is_client,is_collaborator,collaborator_role,notes)
    values(p_company,auth.uid(),v_name,nullif(v_tax,''),nullif(v_address,''),nullif(v_email,''),nullif(v_phone,''),nullif(v_responsible,''),
      coalesce(nullif(v_color,''),'#1976d2'),auth.uid(),v_form,v_client,v_collaborator,nullif(v_role,''),nullif(v_notes,''))
    returning * into result;
  else
    update public.client_company set name=v_name,tax_id=nullif(v_tax,''),billing_address=nullif(v_address,''),email=nullif(v_email,''),
      phone=nullif(v_phone,''),responsible=nullif(v_responsible,''),color=coalesce(nullif(v_color,''),color),
      legal_form=v_form,is_client=v_client,is_collaborator=v_collaborator,collaborator_role=nullif(v_role,''),notes=nullif(v_notes,''),
      updated_at=now(),updated_by=auth.uid()
    where id=p_id and company_id=p_company and archived_at is null returning * into result;
    if result.id is null then raise exception 'Client changed or unavailable' using errcode='40001'; end if;
  end if;
  return result;
end $$;

-- Un documento pertenece a la ficha si coincide el NIF/CIF normalizado; si la ficha no tiene NIF,
-- por nombre exacto (sin mayúsculas ni espacios extremos). Siempre dentro de la misma empresa.
create or replace function public.directory_document_matches(p_document jsonb, p_tax_key text, p_name_key text)
returns boolean language sql immutable set search_path='' as $$
  select case
    when p_tax_key is not null then
      upper(regexp_replace(coalesce(p_document->'customer'->>'taxId',''),'[^A-Za-z0-9]','','g')) = p_tax_key
    else lower(btrim(coalesce(p_document->'customer'->>'name',''))) = p_name_key
  end
$$;

-- Resumen de la ficha: facturación, presupuestos, agenda y movimientos. Lectura para cualquier
-- miembro activo (también lector), igual que el directorio. Cada bloque solo se calcula si su
-- módulo está activo; si no, vuelve null y la interfaz lo oculta.
create or replace function public.get_directory_party_summary(p_company uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare
  party public.client_company;
  tax_key text; name_key text;
  planning_on boolean; billing_on boolean;
  invoices_block jsonb; quotes_block jsonb; planning_block jsonb; movements_block jsonb;
begin
  if auth.uid() is null or p_company is null
    or not coalesce(public.is_platform_admin() or public.is_company_member(p_company),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  planning_on:=public.is_company_module_enabled(p_company,'planning');
  billing_on:=public.is_company_module_enabled(p_company,'billing');
  if not (planning_on or billing_on) then raise exception 'Company module is disabled' using errcode='42501'; end if;

  select * into party from public.client_company where id=p_id and company_id=p_company;
  if party.id is null then raise exception 'Client not found' using errcode='P0002'; end if;
  tax_key:=nullif(upper(regexp_replace(coalesce(party.tax_id,''),'[^A-Za-z0-9]','','g')),'');
  name_key:=lower(btrim(party.name));

  if billing_on then
    with docs as (
      select i.id, i.status, nullif(i.document->>'date','')::date as issued_on, nullif(i.document->>'dueDate','')::date as due_on,
        public.billing_document_total(i.document) as total
      from public.invoices i
      where i.company_id=p_company and i.status in ('issued','paid')
        and public.directory_document_matches(i.document,tax_key,name_key)
    ), paid as (
      select d.id, case when d.status='paid' then d.total
        else least(d.total, greatest(coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0),0)) end as amount
      from docs d left join public.billing_payment_entries e on e.company_id=p_company and e.invoice_id=d.id
      group by d.id, d.status, d.total
    ), months as (
      select to_char(date_trunc('month',d.issued_on),'YYYY-MM') as month, sum(d.total) as total
      from docs d where d.issued_on >= (date_trunc('month',current_date) - interval '11 months')::date
      group by 1
    )
    select jsonb_build_object(
      'count',(select count(*) from docs),
      'total',coalesce((select sum(total) from docs),0),
      'paid',coalesce((select sum(amount) from paid),0),
      'outstanding',coalesce((select sum(greatest(d.total-p.amount,0)) from docs d join paid p using(id)),0),
      'overdue_count',(select count(*) from docs d join paid p using(id) where d.status='issued' and d.due_on<current_date and d.total-p.amount>0),
      'last_issued_on',(select max(issued_on) from docs),
      'monthly',coalesce((select jsonb_agg(jsonb_build_object('month',month,'total',total) order by month) from months),'[]'::jsonb)
    ) into invoices_block;

    with docs as (
      select q.status, public.billing_document_total(q.document) as total
      from public.quotes q
      where q.company_id=p_company and q.status<>'draft' and public.directory_document_matches(q.document,tax_key,name_key)
    )
    select jsonb_build_object(
      'count',count(*),
      'open',count(*) filter (where status='sent'),
      'accepted',count(*) filter (where status in ('accepted','invoiced')),
      'rejected',count(*) filter (where status='rejected'),
      'accepted_total',coalesce(sum(total) filter (where status in ('accepted','invoiced')),0)
    ) into quotes_block from docs;
  end if;

  if planning_on then
    select jsonb_build_object(
      'count',count(*),
      'upcoming',count(*) filter (where t.start_datetime>=now()),
      'last_at',max(t.start_datetime) filter (where t.start_datetime<now()),
      'next',(select jsonb_build_object('id',n.id,'title',n.title,'start',n.start_datetime) from public.planning_task n
              where n.company_id=p_company and n.client_company_id=party.id and n.start_datetime>=now()
              order by n.start_datetime limit 1)
    ) into planning_block
    from public.planning_task t where t.company_id=p_company and t.client_company_id=party.id;

    select jsonb_build_object(
      'count',count(*),
      'to_collect',coalesce(sum(b.amount) filter (where b.direction='cobrar'),0),
      'to_pay',coalesce(sum(b.amount) filter (where b.direction='pagar'),0)
    ) into movements_block
    from public.billing b where b.company_id=p_company and b.client_company_id=party.id;
  end if;

  return jsonb_build_object(
    'party_id',party.id,
    'matched_by',case when tax_key is null then 'name' else 'tax_id' end,
    'invoices',invoices_block,'quotes',quotes_block,'planning',planning_block,'movements',movements_block
  );
end $$;

revoke all on function public.save_directory_party(uuid,uuid,jsonb),public.get_directory_party_summary(uuid,uuid) from public,anon;
grant execute on function public.save_directory_party(uuid,uuid,jsonb),public.get_directory_party_summary(uuid,uuid) to authenticated;
revoke all on function public.directory_document_matches(jsonb,text,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
