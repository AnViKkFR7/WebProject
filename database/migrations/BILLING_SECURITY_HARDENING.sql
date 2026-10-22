-- Aplicar DESPUÉS de INVOICING.sql y QUOTES.sql. No modifica documentos existentes.
begin;

-- Cerrar explícitamente toda escritura REST; solo las RPC autorizadas escriben.
revoke all on public.invoices, public.quotes, public.invoice_settings from public, anon, authenticated;
grant select on public.invoices, public.quotes, public.invoice_settings to authenticated;
do $$ declare p record;
begin
  for p in select tablename,policyname from pg_policies
    where schemaname='public' and tablename in ('invoices','quotes','invoice_settings') loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;
create policy invoices_read on public.invoices for select to authenticated
using (auth.uid() is not null and (public.is_platform_admin() or public.is_company_member(company_id)));
create policy quotes_read on public.quotes for select to authenticated
using (auth.uid() is not null and (public.is_platform_admin() or public.is_company_member(company_id)));
create policy invoice_settings_read on public.invoice_settings for select to authenticated
using (auth.uid() is not null and (public.is_platform_admin() or public.is_company_member(company_id)));

create or replace function public.assert_billing_access(p_company uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or p_company is null or not coalesce(
    public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
end $$;

create or replace function public.validate_billing_profile(p_profile jsonb)
returns void language plpgsql set search_path = pg_catalog, public as $$
declare k text;
begin
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' or octet_length(p_profile::text)>1500000 then
    raise exception 'Invalid billing profile' using errcode='22023';
  end if;
  foreach k in array array['name','taxId','address'] loop
    if jsonb_typeof(p_profile->k) is distinct from 'string' or length(trim(p_profile->>k))=0 then
      raise exception 'Missing issuer field: %',k using errcode='22023';
    end if;
  end loop;
  foreach k in array array['name','taxId','address','email','phone','iban','payment','notes','prefix','quotePrefix','color','logo'] loop
    if p_profile ? k and (jsonb_typeof(p_profile->k) <> 'string'
      or (k <> 'logo' and length(p_profile->>k)>2000)) then
      raise exception 'Invalid profile field: %',k using errcode='22023';
    end if;
  end loop;
  foreach k in array array['prefix','quotePrefix'] loop
    if p_profile ? k and (p_profile->>k) !~ '^[A-Za-z0-9_-]{1,20}$' then
      raise exception 'Invalid numbering series' using errcode='22023';
    end if;
  end loop;
  if p_profile ? 'color' and p_profile->>'color' !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid template color' using errcode='22023';
  end if;
  if coalesce(p_profile->>'logo','') <> '' and
    (length(p_profile->>'logo')>1400000 or p_profile->>'logo' !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$') then
    raise exception 'Invalid logo; only inline PNG/JPEG is allowed' using errcode='22023';
  end if;
end $$;

create or replace function public.validate_billing_document(p_document jsonb)
returns void language plpgsql set search_path = pg_catalog, public as $$
declare k text; line jsonb; amount numeric; base_total numeric:=0;
begin
  if p_document is null or jsonb_typeof(p_document)<>'object' or octet_length(p_document::text)>2000000 then
    raise exception 'Invalid billing document' using errcode='22023';
  end if;
  perform public.validate_billing_profile(p_document->'issuer');
  if jsonb_typeof(p_document->'customer') is distinct from 'object' then
    raise exception 'Invalid customer' using errcode='22023';
  end if;
  foreach k in array array['name','taxId','address'] loop
    if jsonb_typeof(p_document->'customer'->k) is distinct from 'string'
      or length(trim(p_document->'customer'->>k))=0 or length(p_document->'customer'->>k)>2000 then
      raise exception 'Invalid customer field: %',k using errcode='22023';
    end if;
  end loop;
  if p_document->'customer' ? 'email' and (jsonb_typeof(p_document->'customer'->'email')<>'string'
    or length(p_document->'customer'->>'email')>2000) then raise exception 'Invalid customer email' using errcode='22023'; end if;
  foreach k in array array['date','dueDate','payment','iban','notes','sourceQuote'] loop
    if p_document ? k and (jsonb_typeof(p_document->k)<>'string' or length(p_document->>k)>2000) then
      raise exception 'Invalid document field: %',k using errcode='22023';
    end if;
  end loop;
  if coalesce(p_document->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid issue date' using errcode='22023';
  end if;
  perform (p_document->>'date')::date;
  if coalesce(p_document->>'dueDate','') <> '' then
    if p_document->>'dueDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or (p_document->>'dueDate')::date < (p_document->>'date')::date then
      raise exception 'Invalid due date' using errcode='22023';
    end if;
  end if;
  if coalesce(p_document->>'withholding','') !~ '^[0-9]+([.][0-9]{1,2})?$'
    or (p_document->>'withholding')::numeric not between 0 and 100 then
    raise exception 'Invalid withholding' using errcode='22023';
  end if;
  if jsonb_typeof(p_document->'lines') is distinct from 'array' then
    raise exception 'Invalid lines' using errcode='22023';
  end if;
  if jsonb_array_length(p_document->'lines') not between 1 and 1000 then
    raise exception 'Invalid line count' using errcode='22023';
  end if;
  for line in select value from jsonb_array_elements(p_document->'lines') loop
    if jsonb_typeof(line)<>'object' or jsonb_typeof(line->'description') is distinct from 'string'
      or length(trim(line->>'description'))=0 or length(line->>'description')>2000 then
      raise exception 'Invalid line description' using errcode='22023';
    end if;
    foreach k in array array['quantity','price','discount','tax'] loop
      if coalesce(line->>k,'') !~ (case when k='quantity' then '^[0-9]+([.][0-9]{1,3})?$' else '^[0-9]+([.][0-9]{1,2})?$' end) then
        raise exception 'Invalid line number: %',k using errcode='22023';
      end if;
      amount:=(line->>k)::numeric;
      if amount>1000000000 or (k in ('discount','tax') and amount>100)
        or (k='quantity' and amount<=0) then raise exception 'Invalid amount' using errcode='22023'; end if;
      if k<>'quantity' and amount<>round(amount,2) then raise exception 'Invalid monetary precision' using errcode='22023'; end if;
    end loop;
    base_total:=base_total + round((line->>'quantity')::numeric*(line->>'price')::numeric*(1-(line->>'discount')::numeric/100),2);
  end loop;
  if base_total>1000000000000 then raise exception 'Invoice amount too large' using errcode='22023'; end if;
end $$;

-- Evitar que dos editores sobrescriban los datos fiscales y las series.
alter table public.invoice_settings add column if not exists version integer not null default 1;
drop function if exists public.save_invoice_profile(uuid,jsonb);
create or replace function public.save_invoice_profile(p_company uuid,p_profile jsonb,p_version integer default null)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare result integer;
begin
  perform public.assert_billing_access(p_company);
  perform public.validate_billing_profile(p_profile);
  if p_version=0 then
    insert into public.invoice_settings(company_id,profile) values(p_company,p_profile)
      on conflict(company_id) do update set profile=excluded.profile,
        version=invoice_settings.version+1,last_edited_by=auth.uid()
      where invoice_settings.profile='{}'::jsonb and invoice_settings.version=1
      returning version into result;
  else
    update public.invoice_settings set profile=p_profile,version=version+1,last_edited_by=auth.uid()
      where company_id=p_company and version=p_version returning version into result;
  end if;
  if result is null then raise exception 'Profile changed; reload' using errcode='40001'; end if;
  return result;
end $$;

create or replace function public.save_invoice(p_company uuid, p_document jsonb, p_status text,
  p_id uuid default null, p_version integer default null)
returns public.invoices language plpgsql security definer set search_path = pg_catalog, public as $$
declare result public.invoices; seq bigint; prefix text;
begin
  perform public.assert_billing_access(p_company);
  if p_status not in ('draft','issued','paid','cancelled') or p_status is null then raise exception 'Invalid status'; end if;
  perform public.validate_billing_document(p_document);
  if p_id is null then
    if p_status = 'cancelled' then raise exception 'Invalid initial status'; end if;
    insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
    update public.invoice_settings set next_number=next_number+1 where company_id=p_company
      returning next_number-1, coalesce(nullif(profile->>'prefix',''),'F') into seq,prefix;
    insert into public.invoices(company_id,number,status,document)
      values(p_company,prefix || '-' || lpad(seq::text,greatest(6,length(seq::text)),'0'),p_status,p_document) returning * into result;
  else
    if p_version is null then raise exception 'Missing document version' using errcode='40001'; end if;
    update public.invoices set document=p_document,status=p_status,version=version+1,
      updated_at=now(),last_edited_by=auth.uid()
      where id=p_id and company_id=p_company and version=p_version and status <> 'cancelled'
      returning * into result;
    if not found then raise exception 'Invoice changed or cancelled; reload'; end if;
  end if;
  return result;
end $$;

create or replace function public.save_quote(p_company uuid, p_document jsonb, p_status text,
  p_id uuid default null, p_version integer default null)
returns public.quotes language plpgsql security definer set search_path = pg_catalog, public as $$
declare result public.quotes; seq bigint; prefix text;
begin
  perform public.assert_billing_access(p_company);
  if p_status not in ('draft','sent','accepted','rejected','cancelled') or p_status is null then raise exception 'Invalid status'; end if;
  perform public.validate_billing_document(p_document);
  if p_id is null then
    if p_status in ('cancelled') then raise exception 'Invalid initial status'; end if;
    insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
    update public.invoice_settings set next_quote_number=next_quote_number+1 where company_id=p_company
      returning next_quote_number-1, coalesce(nullif(profile->>'quotePrefix',''),'P') into seq,prefix;
    insert into public.quotes(company_id,number,status,document)
      values(p_company,prefix || '-' || lpad(seq::text,greatest(6,length(seq::text)),'0'),p_status,p_document) returning * into result;
  else
    if p_version is null then raise exception 'Missing document version' using errcode='40001'; end if;
    update public.quotes set document=p_document,status=p_status,version=version+1,
      updated_at=now(),last_edited_by=auth.uid()
      where id=p_id and company_id=p_company and version=p_version and status not in ('cancelled','invoiced')
      returning * into result;
    if not found then raise exception 'Quote changed or closed; reload'; end if;
  end if;
  return result;
end $$;

create or replace function public.convert_quote_to_invoice(p_company uuid, p_id uuid, p_version integer)
returns public.quotes language plpgsql security definer set search_path = pg_catalog, public as $$
declare source public.quotes; created public.invoices; result public.quotes;
begin
  perform public.assert_billing_access(p_company);
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

create unique index if not exists invoices_tenant_id_unique on public.invoices(company_id,id);
alter table public.quotes drop constraint if exists quotes_invoice_same_tenant;
alter table public.quotes add constraint quotes_invoice_same_tenant foreign key(company_id,invoice_id)
  references public.invoices(company_id,id);

revoke all on function public.assert_billing_access(uuid) from public,anon,authenticated;
revoke all on function public.validate_billing_profile(jsonb) from public,anon,authenticated;
revoke all on function public.validate_billing_document(jsonb) from public,anon,authenticated;
revoke all on function public.save_invoice_profile(uuid,jsonb,integer) from public,anon;
revoke all on function public.save_invoice(uuid,jsonb,text,uuid,integer) from public,anon;
revoke all on function public.save_quote(uuid,jsonb,text,uuid,integer) from public,anon;
revoke all on function public.convert_quote_to_invoice(uuid,uuid,integer) from public,anon;
grant execute on function public.save_invoice_profile(uuid,jsonb,integer) to authenticated;
grant execute on function public.save_invoice(uuid,jsonb,text,uuid,integer) to authenticated;
grant execute on function public.save_quote(uuid,jsonb,text,uuid,integer) to authenticated;
grant execute on function public.convert_quote_to_invoice(uuid,uuid,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
