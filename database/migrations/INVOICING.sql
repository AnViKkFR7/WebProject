-- Facturación: ejecutar en SQL Editor tras DB_SCHEMA.sql.
begin;
create table if not exists public.invoice_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  next_number bigint not null default 1 check (next_number > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  last_edited_by uuid not null default auth.uid() references auth.users(id)
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number text not null,
  status text not null default 'draft' check (status in ('draft','issued','paid','cancelled')),
  document jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  last_edited_by uuid not null default auth.uid() references auth.users(id),
  unique(company_id, number)
);
create index if not exists invoices_company_created_idx on public.invoices(company_id, created_at desc);
alter table public.invoice_settings enable row level security;
alter table public.invoices enable row level security;
drop policy if exists invoice_settings_read on public.invoice_settings;
create policy invoice_settings_read on public.invoice_settings for select to authenticated
using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated
using (public.is_platform_admin() or public.is_company_member(company_id));
-- Todas las escrituras pasan por RPC: numeración atómica y permisos en servidor.
create or replace function public.save_invoice_profile(p_company uuid, p_profile jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_platform_admin() or public.has_company_role(p_company, array['admin','editor'])) then
    raise exception 'Forbidden';
  end if;
  insert into public.invoice_settings(company_id,profile) values(p_company,p_profile)
  on conflict(company_id) do update set profile=excluded.profile,last_edited_by=auth.uid();
end $$;
create or replace function public.save_invoice(p_company uuid, p_document jsonb, p_status text,
  p_id uuid default null, p_version integer default null)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare result public.invoices; seq bigint; prefix text;
begin
  if not (public.is_platform_admin() or public.has_company_role(p_company, array['admin','editor'])) then
    raise exception 'Forbidden';
  end if;
  if p_status not in ('draft','issued','paid','cancelled') or p_status is null then raise exception 'Invalid status'; end if;
  if jsonb_typeof(p_document->'lines') is distinct from 'array' or jsonb_array_length(p_document->'lines') = 0
    or coalesce(trim(p_document->'customer'->>'name'),'') = ''
    or coalesce(p_document->>'date','') = ''
    or coalesce(trim(p_document->'customer'->>'taxId'),'') = ''
    or coalesce(trim(p_document->'customer'->>'address'),'') = ''
    or coalesce(trim(p_document->'issuer'->>'name'),'') = ''
    or coalesce(trim(p_document->'issuer'->>'taxId'),'') = ''
    or coalesce(trim(p_document->'issuer'->>'address'),'') = ''
    or coalesce((p_document->>'withholding')::numeric,-1) not between 0 and 100
    or (nullif(p_document->>'dueDate','')::date < (p_document->>'date')::date) then raise exception 'Invalid invoice'; end if;
  if exists (select 1 from jsonb_array_elements(p_document->'lines') l
    where coalesce(trim(l->>'description'),'') = '' or coalesce((l->>'quantity')::numeric,0) <= 0
      or coalesce((l->>'price')::numeric,-1) < 0 or coalesce((l->>'tax')::numeric,-1) not between 0 and 100
      or coalesce((l->>'discount')::numeric,-1) not between 0 and 100) then raise exception 'Invalid line'; end if;
  if p_id is null then
    if p_status = 'cancelled' then raise exception 'Invalid initial status'; end if;
    insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
    update public.invoice_settings set next_number=next_number+1 where company_id=p_company
      returning next_number-1, coalesce(nullif(profile->>'prefix',''),'F') into seq,prefix;
    insert into public.invoices(company_id,number,status,document)
      values(p_company,prefix || '-' || lpad(seq::text,greatest(6,length(seq::text)),'0'),p_status,p_document) returning * into result;
  else
    update public.invoices set document=p_document,status=p_status,version=version+1,
      updated_at=now(),last_edited_by=auth.uid()
      where id=p_id and company_id=p_company and version=p_version and status <> 'cancelled'
      returning * into result;
    if not found then raise exception 'Invoice changed or cancelled; reload'; end if;
  end if;
  return result;
end $$;
revoke all on function public.save_invoice_profile(uuid,jsonb) from public;
revoke all on function public.save_invoice(uuid,jsonb,text,uuid,integer) from public;
grant execute on function public.save_invoice_profile(uuid,jsonb) to authenticated;
grant execute on function public.save_invoice(uuid,jsonb,text,uuid,integer) to authenticated;
commit;
