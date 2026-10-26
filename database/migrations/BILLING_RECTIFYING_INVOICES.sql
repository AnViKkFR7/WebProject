-- Apply after BILLING_ISSUED_INVOICE_LOCK.sql. New append-only invoice rows;
-- the company's rectification sequence is allocated in the same transaction.
begin;

alter table public.invoice_settings
  add column if not exists next_rectification_number bigint not null default 1
    check(next_rectification_number>0);
alter table public.invoices
  add column if not exists rectifies_invoice_id uuid,
  add column if not exists rectification_method text,
  add column if not exists rectification_cause text,
  add column if not exists rectification_request_id uuid;
create unique index if not exists invoices_company_rectification_request_uq
  on public.invoices(company_id,rectification_request_id) where rectification_request_id is not null;
create unique index if not exists invoices_company_id_uq on public.invoices(company_id,id);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='invoices_rectifies_same_company_fk') then
    alter table public.invoices add constraint invoices_rectifies_same_company_fk
      foreign key(company_id,rectifies_invoice_id) references public.invoices(company_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conname='invoices_rectification_method_check') then
    alter table public.invoices add constraint invoices_rectification_method_check
      check(rectification_method is null or rectification_method in('difference','substitution'));
  end if;
  if not exists(select 1 from pg_constraint where conname='invoices_rectification_fields_check') then
    alter table public.invoices add constraint invoices_rectification_fields_check
      check((rectifies_invoice_id is null and rectification_method is null and rectification_cause is null and rectification_request_id is null)
         or (rectifies_invoice_id is not null and rectification_method is not null and nullif(trim(rectification_cause),'') is not null and rectification_request_id is not null));
  end if;
end $$;

create or replace function public.validate_billing_profile(p_profile jsonb)
returns void language plpgsql set search_path=pg_catalog,public as $$
declare k text;
begin
  if p_profile is null or jsonb_typeof(p_profile)<>'object' or octet_length(p_profile::text)>1500000 then raise exception 'Invalid billing profile' using errcode='22023';end if;
  foreach k in array array['name','taxId','address'] loop
    if jsonb_typeof(p_profile->k) is distinct from 'string' or length(trim(p_profile->>k))=0 then raise exception 'Missing issuer field: %',k using errcode='22023';end if;
  end loop;
  foreach k in array array['name','taxId','address','email','phone','iban','payment','notes','prefix','quotePrefix','rectificationPrefix','color','logo'] loop
    if p_profile?k and (jsonb_typeof(p_profile->k)<>'string' or (k<>'logo' and length(p_profile->>k)>2000)) then raise exception 'Invalid profile field: %',k using errcode='22023';end if;
  end loop;
  foreach k in array array['prefix','quotePrefix','rectificationPrefix'] loop
    if p_profile?k and p_profile->>k !~ '^[A-Za-z0-9_-]{1,20}$' then raise exception 'Invalid numbering series' using errcode='22023';end if;
  end loop;
  if p_profile? 'color' and p_profile->>'color' !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid template color' using errcode='22023';end if;
  if coalesce(p_profile->>'logo','')<>'' and (length(p_profile->>'logo')>1400000 or p_profile->>'logo' !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$') then raise exception 'Invalid logo' using errcode='22023';end if;
end $$;

-- Prevent clients from bypassing rectify_invoice by inserting fabricated metadata
-- through the ordinary invoice RPC.
create or replace function public.save_invoice(p_company uuid,p_document jsonb,p_status text,
  p_id uuid default null,p_version integer default null)
returns public.invoices language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.invoices;seq bigint;prefix text;
begin
  perform public.assert_billing_access(p_company);
  if p_document?'rectification' then raise exception 'Use rectify_invoice for rectifying invoices' using errcode='42501';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'lines') line where line?'sign') then raise exception 'Correction signs are only valid on rectifying invoices' using errcode='42501';end if;
  perform public.validate_billing_document(p_document);
  if p_id is null then
    if p_status not in('draft','issued') or p_status is null then raise exception 'Invalid initial invoice status';end if;
    insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
    update public.invoice_settings set next_number=next_number+1 where company_id=p_company
      returning next_number-1,coalesce(nullif(profile->>'prefix',''),'F') into seq,prefix;
    insert into public.invoices(company_id,number,status,document)
      values(p_company,prefix||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),p_status,p_document) returning * into result;
  else
    if p_version is null then raise exception 'Missing document version' using errcode='40001';end if;
    select * into result from public.invoices where id=p_id and company_id=p_company for update;
    if not found or result.version is distinct from p_version or result.status='cancelled' then raise exception 'Invoice changed or cancelled; reload' using errcode='40001';end if;
    if result.status<>'draft' then raise exception 'Issued invoices are immutable; use a rectifying invoice' using errcode='55000';end if;
    if p_status not in('draft','issued','cancelled') or p_status is null then raise exception 'Invalid status';end if;
    update public.invoices set document=p_document,status=p_status,version=version+1,updated_at=now(),last_edited_by=auth.uid()
      where id=p_id and company_id=p_company and version=p_version and status='draft' returning * into result;
    if not found then raise exception 'Invoice changed; reload' using errcode='40001';end if;
  end if;
  return result;
end $$;

create or replace function public.billing_document_total(p_document jsonb)
returns numeric language sql immutable set search_path='' as $$
  with rows as(select (case when line->>'sign'='-1' then -1 else 1 end)*round((line->>'quantity')::numeric*(line->>'price')::numeric*(1-(line->>'discount')::numeric/100),2) base,(line->>'tax')::numeric tax from jsonb_array_elements(p_document->'lines') line),
  sums as(select coalesce(sum(base),0) base,coalesce(sum(round(base*tax/100,2)),0) tax from rows)
  select round(base+tax-round(base*coalesce((p_document->>'withholding')::numeric,0)/100,2),2) from sums
$$;

create or replace function public.get_invoice_financials(p_company uuid)
returns table(invoice_id uuid,total numeric,paid numeric,balance numeric,payment_state text,due_date date)
language plpgsql security definer set search_path='' as $$
begin
  if not(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor','viewer'])) then raise exception 'Forbidden' using errcode='42501';end if;
  return query select i.id,t.total,coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)::numeric,
    greatest(t.total-coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0),0)::numeric,
    case when t.total<0 then 'credit'
      when coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)<=0 then case when i.status='issued' and nullif(i.document->>'dueDate','')::date<current_date then 'overdue' else 'outstanding' end
      when coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)<t.total then 'partial' else 'paid' end,
    nullif(i.document->>'dueDate','')::date
  from public.invoices i cross join lateral(select public.billing_document_total(i.document) total)t left join public.billing_payment_entries e on e.invoice_id=i.id and e.company_id=i.company_id
  where i.company_id=p_company and i.status in('issued','paid') group by i.id,t.total;
end $$;
-- This is a pure aggregate over the caller-supplied document; authenticated
-- users need it for invoice totals, while anonymous/public callers do not.
revoke all on function public.billing_document_total(jsonb) from public,anon;
grant execute on function public.billing_document_total(jsonb) to authenticated;

create or replace function public.rectify_invoice(p_company uuid,p_original uuid,p_document jsonb,
  p_method text,p_cause text,p_note text,p_request uuid)
returns public.invoices language plpgsql security definer set search_path=pg_catalog,public as $$
declare original public.invoices;result public.invoices;seq bigint;prefix text;line jsonb;
begin
  perform public.assert_billing_access(p_company);
  if p_method not in('difference','substitution') or p_method is null
    or p_cause not in('required_data','incorrect_tax','article_80','other') or p_cause is null
    or nullif(trim(p_note),'') is null or length(p_note)>2000 or p_request is null then raise exception 'Invalid rectification details' using errcode='22023';end if;
  select * into result from public.invoices where company_id=p_company and rectification_request_id=p_request;
  if found then return result;end if;
  select * into original from public.invoices where company_id=p_company and id=p_original for update;
  if not found or original.status not in('issued','paid') then raise exception 'Original invoice is not eligible for rectification' using errcode='22023';end if;
  select * into result from public.invoices where company_id=p_company and rectification_request_id=p_request;
  if found then return result;end if;
  perform public.validate_billing_document(p_document);
  if p_document?'rectification' then raise exception 'Rectification metadata is server controlled' using errcode='22023';end if;
  if p_method='difference' then
    for line in select value from jsonb_array_elements(p_document->'lines') loop
      if line?'sign' and line->>'sign' not in('1','-1') then raise exception 'Invalid correction sign' using errcode='22023';end if;
    end loop;
  else
    for line in select value from jsonb_array_elements(p_document->'lines') loop
      if line?'sign' then raise exception 'Replacement lines cannot carry a sign' using errcode='22023';end if;
    end loop;
  end if;
  insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
  update public.invoice_settings set next_rectification_number=next_rectification_number+1
    where company_id=p_company
    returning next_rectification_number-1,coalesce(nullif(profile->>'rectificationPrefix',''),'FR') into seq,prefix;
  insert into public.invoices(company_id,number,status,document,rectifies_invoice_id,rectification_method,rectification_cause,rectification_request_id)
  values(p_company,prefix||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),'issued',
    jsonb_set(p_document,'{rectification}',jsonb_build_object('originalId',original.id,'originalNumber',original.number,
      'method',p_method,'cause',p_cause,'note',trim(p_note),'originalTotal',public.billing_document_total(original.document))),
    original.id,p_method,p_cause,p_request) returning * into result;
  return result;
end $$;
revoke all on function public.rectify_invoice(uuid,uuid,jsonb,text,text,text,uuid) from public,anon;
grant execute on function public.rectify_invoice(uuid,uuid,jsonb,text,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
