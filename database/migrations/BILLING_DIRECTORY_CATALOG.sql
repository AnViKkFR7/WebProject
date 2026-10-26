-- After BILLING_APPEARANCE.sql. Reuses the planning client directory and adds a company catalogue.
begin;

alter table public.client_company add column if not exists tax_id text;
alter table public.client_company add column if not exists billing_address text;
alter table public.client_company add column if not exists phone text;
alter table public.client_company add column if not exists email text;
alter table public.client_company add column if not exists responsible text;
alter table public.client_company add column if not exists color text;
alter table public.client_company add column if not exists user_id uuid references auth.users(id);
alter table public.client_company add column if not exists archived_at timestamptz;
alter table public.client_company add column if not exists updated_at timestamptz not null default now();
alter table public.client_company add column if not exists updated_by uuid references auth.users(id);

create table if not exists public.billing_catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text not null default '',
  unit text not null default '',
  price numeric(14,2) not null default 0 check(price between 0 and 1000000000),
  tax numeric(5,2) not null default 21 check(tax between 0 and 100),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index if not exists billing_catalog_active_name_unique
  on public.billing_catalog_items(company_id,lower(name)) where archived_at is null;
alter table public.billing_catalog_items enable row level security;
revoke all on public.billing_catalog_items from public,anon,authenticated;
grant select on public.billing_catalog_items to authenticated;
drop policy if exists billing_catalog_read on public.billing_catalog_items;
create policy billing_catalog_read on public.billing_catalog_items for select to authenticated
using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor','viewer']));

create or replace function public.save_client_company(p_company uuid,p_id uuid,p_name text,p_tax_id text,p_billing_address text,p_email text,p_phone text,p_responsible text,p_color text)
returns public.client_company language plpgsql security definer set search_path='' as $$
declare result public.client_company;
begin
  perform public.assert_billing_access(p_company);
  p_name:=trim(coalesce(p_name,''));p_tax_id:=trim(coalesce(p_tax_id,''));p_billing_address:=trim(coalesce(p_billing_address,''));
  p_email:=trim(coalesce(p_email,''));p_phone:=trim(coalesce(p_phone,''));p_responsible:=trim(coalesce(p_responsible,''));
  if length(p_name) not between 1 and 300 or length(p_tax_id)>100 or length(p_billing_address)>2000 or length(p_email)>320 or length(p_phone)>100 or length(p_responsible)>300
    or (coalesce(p_color,'')<>'' and p_color !~ '^#[0-9A-Fa-f]{6}$') then raise exception 'Invalid client data' using errcode='22023'; end if;
  if p_id is null then
    insert into public.client_company(company_id,user_id,name,tax_id,billing_address,email,phone,responsible,color,updated_by)
    values(p_company,auth.uid(),p_name,nullif(p_tax_id,''),nullif(p_billing_address,''),nullif(p_email,''),nullif(p_phone,''),nullif(p_responsible,''),coalesce(nullif(p_color,''),'#1976d2'),auth.uid()) returning * into result;
  else
    update public.client_company set name=p_name,tax_id=nullif(p_tax_id,''),billing_address=nullif(p_billing_address,''),email=nullif(p_email,''),phone=nullif(p_phone,''),responsible=nullif(p_responsible,''),
      color=coalesce(nullif(p_color,''),color),updated_at=now(),updated_by=auth.uid()
    where id=p_id and company_id=p_company and archived_at is null returning * into result;
    if result.id is null then raise exception 'Client changed or unavailable' using errcode='40001'; end if;
  end if;
  return result;
end $$;

create or replace function public.archive_client_company(p_company uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_billing_access(p_company);
  update public.client_company set archived_at=now(),updated_at=now(),updated_by=auth.uid() where id=p_id and company_id=p_company and archived_at is null;
  if not found then raise exception 'Client changed or unavailable' using errcode='40001'; end if;
end $$;

create or replace function public.save_billing_catalog_item(p_company uuid,p_id uuid,p_name text,p_description text,p_unit text,p_price numeric,p_tax numeric)
returns public.billing_catalog_items language plpgsql security definer set search_path='' as $$
declare result public.billing_catalog_items;
begin
  perform public.assert_billing_access(p_company);
  p_name:=trim(coalesce(p_name,''));p_description:=trim(coalesce(p_description,''));p_unit:=trim(coalesce(p_unit,''));
  if length(p_name) not between 1 and 300 or length(p_description)>2000 or length(p_unit)>100 or p_price is null or p_price<0 or p_price>1000000000 or p_price<>round(p_price,2)
    or p_tax is null or p_tax<0 or p_tax>100 or p_tax<>round(p_tax,2) then raise exception 'Invalid catalogue item' using errcode='22023'; end if;
  if p_id is null then
    insert into public.billing_catalog_items(company_id,name,description,unit,price,tax,created_by,updated_by)
    values(p_company,p_name,p_description,p_unit,p_price,p_tax,auth.uid(),auth.uid()) returning * into result;
  else
    update public.billing_catalog_items set name=p_name,description=p_description,unit=p_unit,price=p_price,tax=p_tax,updated_at=now(),updated_by=auth.uid()
    where id=p_id and company_id=p_company and archived_at is null returning * into result;
    if result.id is null then raise exception 'Catalogue item changed or unavailable' using errcode='40001'; end if;
  end if;
  return result;
exception when unique_violation then raise exception 'Catalogue name already exists' using errcode='23505';
end $$;

create or replace function public.archive_billing_catalog_item(p_company uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_billing_access(p_company);
  update public.billing_catalog_items set archived_at=now(),updated_at=now(),updated_by=auth.uid() where id=p_id and company_id=p_company and archived_at is null;
  if not found then raise exception 'Catalogue item changed or unavailable' using errcode='40001'; end if;
end $$;

revoke insert,update,delete on public.client_company from authenticated;
revoke all on function public.save_client_company(uuid,uuid,text,text,text,text,text,text,text),public.archive_client_company(uuid,uuid),
  public.save_billing_catalog_item(uuid,uuid,text,text,text,numeric,numeric),public.archive_billing_catalog_item(uuid,uuid) from public,anon;
grant execute on function public.save_client_company(uuid,uuid,text,text,text,text,text,text,text),public.archive_client_company(uuid,uuid),
  public.save_billing_catalog_item(uuid,uuid,text,text,text,numeric,numeric),public.archive_billing_catalog_item(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
