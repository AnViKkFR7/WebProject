-- Enlaces explícitos entre contactos y documentos de facturación.
-- Aplicar después de CRM_PRIVACY_CONTROLS.sql y de las tablas INVOICING/QUOTES.
begin;

create table if not exists public.crm_billing_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid not null,
  document_kind text not null check (document_kind in ('invoice','quote')),
  document_id uuid not null,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  foreign key(company_id,contact_id) references public.crm_contacts(company_id,id) on delete cascade,
  unique(company_id,document_kind,document_id)
);
create index if not exists crm_billing_links_contact_idx
  on public.crm_billing_links(company_id,contact_id,linked_at desc);

create or replace function public.delete_crm_billing_document_link()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.crm_billing_links where company_id=old.company_id and document_id=old.id
    and document_kind=case tg_table_name when 'invoices' then 'invoice' else 'quote' end;
  return old;
end $$;
drop trigger if exists invoices_delete_crm_link on public.invoices;
create trigger invoices_delete_crm_link after delete on public.invoices for each row execute function public.delete_crm_billing_document_link();
drop trigger if exists quotes_delete_crm_link on public.quotes;
create trigger quotes_delete_crm_link after delete on public.quotes for each row execute function public.delete_crm_billing_document_link();
alter table public.crm_billing_links enable row level security;
revoke all on public.crm_billing_links from public,anon,authenticated;

create or replace function public.assert_crm_billing_modules(p_company uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare crm_enabled boolean; billing_enabled boolean;
begin
  if pg_catalog.to_regprocedure('public.is_company_module_enabled(uuid,text)') is not null then
    execute 'select public.is_company_module_enabled($1,$2)' into crm_enabled using p_company,'crm';
    execute 'select public.is_company_module_enabled($1,$2)' into billing_enabled using p_company,'billing';
    if not coalesce(crm_enabled,true) or not coalesce(billing_enabled,true) then raise exception 'Module disabled' using errcode='42501'; end if;
  end if;
end $$;

create or replace function public.link_crm_billing_document(
  p_company uuid,p_contact uuid,p_kind text,p_document uuid
) returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare result uuid; document_company uuid;
begin
  perform public.assert_crm_billing_modules(p_company);
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_kind not in ('invoice','quote') then raise exception 'Invalid document kind' using errcode='22023'; end if;
  if not exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_contact) then
    raise exception 'Contact not found' using errcode='P0002';
  end if;
  if p_kind='invoice' then select i.company_id into document_company from public.invoices i where i.id=p_document;
  else select q.company_id into document_company from public.quotes q where q.id=p_document; end if;
  if document_company is distinct from p_company then raise exception 'Document not found in company' using errcode='42501'; end if;
  insert into public.crm_billing_links(company_id,contact_id,document_kind,document_id,linked_by)
  values(p_company,p_contact,p_kind,p_document,auth.uid())
  on conflict(company_id,document_kind,document_id) do update set contact_id=excluded.contact_id,linked_by=excluded.linked_by,linked_at=now()
  returning id into result;
  return result;
end $$;

create or replace function public.list_crm_billing_documents(p_company uuid,p_contact uuid)
returns table(id uuid,document_kind text,document_id uuid,number text,status text,document jsonb,linked_at timestamptz)
language plpgsql security definer set search_path='' set row_security=off as $$
begin
  perform public.assert_crm_billing_modules(p_company);
  if not coalesce(public.is_platform_admin() or public.is_company_member(p_company),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if not exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_contact) then
    raise exception 'Contact not found' using errcode='P0002';
  end if;
  return query
    select l.id,l.document_kind,l.document_id,i.number,i.status,i.document,l.linked_at
      from public.crm_billing_links l join public.invoices i on l.document_kind='invoice' and i.id=l.document_id and i.company_id=l.company_id
      where l.company_id=p_company and l.contact_id=p_contact
    union all
    select l.id,l.document_kind,l.document_id,q.number,q.status,q.document,l.linked_at
      from public.crm_billing_links l join public.quotes q on l.document_kind='quote' and q.id=l.document_id and q.company_id=l.company_id
      where l.company_id=p_company and l.contact_id=p_contact
    order by 7 desc;
end $$;

create or replace function public.unlink_crm_billing_document(p_company uuid,p_link uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
  perform public.assert_crm_billing_modules(p_company);
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  delete from public.crm_billing_links where company_id=p_company and id=p_link;
  if not found then raise exception 'Link not found' using errcode='P0002'; end if;
end $$;

create or replace function public.list_crm_linkable_billing_documents(p_company uuid,p_contact uuid)
returns table(id uuid,document_kind text,number text,status text,customer_name text,document_date text)
language plpgsql security definer set search_path='' set row_security=off as $$
begin
  perform public.assert_crm_billing_modules(p_company);
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if not exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_contact) then
    raise exception 'Contact not found' using errcode='P0002';
  end if;
  return query
    select i.id,'invoice'::text,i.number,i.status,i.document#>>'{customer,name}',i.document->>'date'
      from public.invoices i where i.company_id=p_company and not exists(select 1 from public.crm_billing_links l where l.company_id=p_company and l.document_kind='invoice' and l.document_id=i.id)
    union all
    select q.id,'quote'::text,q.number,q.status,q.document#>>'{customer,name}',q.document->>'date'
      from public.quotes q where q.company_id=p_company and not exists(select 1 from public.crm_billing_links l where l.company_id=p_company and l.document_kind='quote' and l.document_id=q.id)
    order by 6 desc nulls last,3 desc limit 200;
end $$;

-- Include links/documents in the privacy export; anonymization deletes only the association.
create or replace function public.export_crm_contact(p_company uuid,p_contact uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare contact_row public.crm_contacts; result jsonb;
begin
  perform public.assert_crm_privacy_admin(p_company);
  select * into contact_row from public.crm_contacts where company_id=p_company and id=p_contact;
  if not found then raise exception 'Contact not found' using errcode='P0002'; end if;
  select pg_catalog.jsonb_build_object(
    'schema_version',2,'exported_at',pg_catalog.now(),'contact',pg_catalog.to_jsonb(contact_row),
    'requests',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.created_at,l.id) from public.lead l where l.company_id=p_company and l.crm_contact_id=p_contact),'[]'::jsonb),
    'activities',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) order by a.occurred_at,a.id) from public.crm_activities a where a.company_id=p_company and a.contact_id=p_contact),'[]'::jsonb),
    'billing_documents',coalesce((select pg_catalog.jsonb_agg(x.entry order by x.linked_at)
      from (select pg_catalog.jsonb_build_object('kind',l.document_kind,'number',i.number,'status',i.status,'document',i.document,'linked_at',l.linked_at) as entry,l.linked_at
        from public.crm_billing_links l join public.invoices i on l.document_kind='invoice' and i.id=l.document_id and i.company_id=l.company_id
        where l.company_id=p_company and l.contact_id=p_contact
        union all
        select pg_catalog.jsonb_build_object('kind',l.document_kind,'number',q.number,'status',q.status,'document',q.document,'linked_at',l.linked_at),l.linked_at
        from public.crm_billing_links l join public.quotes q on l.document_kind='quote' and q.id=l.document_id and q.company_id=l.company_id
        where l.company_id=p_company and l.contact_id=p_contact) x),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.preview_crm_contact_anonymization(p_company uuid,p_contact uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
begin
  perform public.assert_crm_privacy_admin(p_company);
  if not exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_contact) then
    raise exception 'Contact not found' using errcode='P0002';
  end if;
  return pg_catalog.jsonb_build_object(
    'lead_count',(select pg_catalog.count(*) from public.lead where company_id=p_company and crm_contact_id=p_contact),
    'activity_count',(select pg_catalog.count(*) from public.crm_activities where company_id=p_company and contact_id=p_contact),
    'billing_document_count',(select pg_catalog.count(*) from public.crm_billing_links where company_id=p_company and contact_id=p_contact)
  );
end $$;

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
    source_path=null,source_referrer=null,source_campaign=null,source_utm_source=null,source_utm_medium=null,source_utm_term=null,source_utm_content=null,
    consent_given=false,consent_at=null,consent_text_version=null,consent_source=null,crm_contact_id=null,crm_stage_id=null,crm_match_state='anonymized'
    where company_id=p_company and crm_contact_id=p_contact;
  delete from public.crm_billing_links where company_id=p_company and contact_id=p_contact;
  delete from public.crm_contacts where company_id=p_company and id=p_contact;
  result:=pg_catalog.jsonb_build_object('lead_count',lead_count,'activity_count',activity_count,'billing_document_count',billing_document_count,'anonymized',true,'already_applied',false);
  insert into public.crm_privacy_audit(company_id,request_id,action,affected_counts,performed_by)
    values(p_company,p_request,'anonymize',result,auth.uid());
  return result;
end $$;

revoke all on function public.link_crm_billing_document(uuid,uuid,text,uuid),public.list_crm_billing_documents(uuid,uuid),public.unlink_crm_billing_document(uuid,uuid),public.list_crm_linkable_billing_documents(uuid,uuid) from public,anon;
revoke all on function public.assert_crm_billing_modules(uuid) from public,anon,authenticated;
revoke all on function public.delete_crm_billing_document_link() from public,anon,authenticated;
grant execute on function public.link_crm_billing_document(uuid,uuid,text,uuid),public.list_crm_billing_documents(uuid,uuid),public.unlink_crm_billing_document(uuid,uuid),public.list_crm_linkable_billing_documents(uuid,uuid) to authenticated,service_role;
revoke all on function public.export_crm_contact(uuid,uuid) from public,anon;
grant execute on function public.export_crm_contact(uuid,uuid) to authenticated,service_role;
commit;
