-- Ejecutar después de INVOICING.sql. Datos de emisor compartidos, numeración independiente.
begin;
alter table public.invoice_settings add column if not exists next_quote_number bigint not null default 1 check (next_quote_number > 0);
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number text not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','invoiced','cancelled')),
  document jsonb not null,
  invoice_id uuid unique references public.invoices(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  last_edited_by uuid not null default auth.uid() references auth.users(id),
  unique(company_id,number),
  check ((status = 'invoiced') = (invoice_id is not null))
);
create index if not exists quotes_company_created_idx on public.quotes(company_id,created_at desc);
alter table public.quotes enable row level security;
drop policy if exists quotes_read on public.quotes;
create policy quotes_read on public.quotes for select to authenticated
using (public.is_platform_admin() or public.is_company_member(company_id));
create or replace function public.save_quote(p_company uuid, p_document jsonb, p_status text,
  p_id uuid default null, p_version integer default null)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare result public.quotes; seq bigint; prefix text;
begin
  if not (public.is_platform_admin() or public.has_company_role(p_company, array['admin','editor'])) then
    raise exception 'Forbidden';
  end if;
  if p_status not in ('draft','sent','accepted','rejected','cancelled') or p_status is null then raise exception 'Invalid status'; end if;
  if jsonb_typeof(p_document->'lines') is distinct from 'array' or jsonb_array_length(p_document->'lines') = 0
    or coalesce(trim(p_document->'customer'->>'name'),'') = ''
    or coalesce(p_document->>'date','') = ''
    or coalesce(trim(p_document->'customer'->>'taxId'),'') = ''
    or coalesce(trim(p_document->'customer'->>'address'),'') = ''
    or coalesce(trim(p_document->'issuer'->>'name'),'') = ''
    or coalesce(trim(p_document->'issuer'->>'taxId'),'') = ''
    or coalesce(trim(p_document->'issuer'->>'address'),'') = ''
    or coalesce((p_document->>'withholding')::numeric,-1) not between 0 and 100
    or (nullif(p_document->>'dueDate','')::date < (p_document->>'date')::date) then raise exception 'Invalid quote'; end if;
  if exists (select 1 from jsonb_array_elements(p_document->'lines') l
    where coalesce(trim(l->>'description'),'') = '' or coalesce((l->>'quantity')::numeric,0) <= 0
      or coalesce((l->>'price')::numeric,-1) < 0 or coalesce((l->>'tax')::numeric,-1) not between 0 and 100
      or coalesce((l->>'discount')::numeric,-1) not between 0 and 100) then raise exception 'Invalid line'; end if;
  if p_id is null then
    if p_status in ('cancelled') then raise exception 'Invalid initial status'; end if;
    insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
    update public.invoice_settings set next_quote_number=next_quote_number+1 where company_id=p_company
      returning next_quote_number-1, coalesce(nullif(profile->>'quotePrefix',''),'P') into seq,prefix;
    insert into public.quotes(company_id,number,status,document)
      values(p_company,prefix || '-' || lpad(seq::text,greatest(6,length(seq::text)),'0'),p_status,p_document) returning * into result;
  else
    update public.quotes set document=p_document,status=p_status,version=version+1,
      updated_at=now(),last_edited_by=auth.uid()
      where id=p_id and company_id=p_company and version=p_version and status not in ('cancelled','invoiced')
      returning * into result;
    if not found then raise exception 'Quote changed or closed; reload'; end if;
  end if;
  return result;
end $$;

create or replace function public.convert_quote_to_invoice(p_company uuid, p_id uuid, p_version integer)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare source public.quotes; created public.invoices; result public.quotes;
begin
  if not (public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor'])) then
    raise exception 'Forbidden';
  end if;
  select * into source from public.quotes where id=p_id and company_id=p_company for update;
  if not found or p_version is null or source.version <> p_version or source.status <> 'accepted' then
    raise exception 'Quote changed or not accepted; reload';
  end if;
  -- Una única transacción y bloqueo de fila impiden conversiones duplicadas.
  created := public.save_invoice(p_company,
    source.document || jsonb_build_object('date', to_char(now() at time zone 'Europe/Madrid','YYYY-MM-DD'),
      'dueDate', '', 'sourceQuote',source.number), 'draft');
  update public.quotes set status='invoiced',invoice_id=created.id,version=version+1,
    updated_at=now(),last_edited_by=auth.uid() where id=source.id returning * into result;
  return result;
end $$;
revoke all on function public.save_quote(uuid,jsonb,text,uuid,integer) from public;
revoke all on function public.convert_quote_to_invoice(uuid,uuid,integer) from public;
grant execute on function public.save_quote(uuid,jsonb,text,uuid,integer) to authenticated;
grant execute on function public.convert_quote_to_invoice(uuid,uuid,integer) to authenticated;
commit;
