-- Apply after BILLING_SECURITY_HARDENING.sql. Optional fields preserve existing documents.
begin;
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
  if p_document ? 'presentation' then
    if jsonb_typeof(p_document->'presentation') is distinct from 'object' then raise exception 'Invalid presentation' using errcode='22023'; end if;
    foreach k in array array['title','site','introduction','conditions'] loop
      if p_document->'presentation' ? k and (jsonb_typeof(p_document->'presentation'->k) is distinct from 'string'
        or length(p_document->'presentation'->>k) > case when k in ('title','site') then 300 else 2000 end) then
        raise exception 'Invalid presentation field: %',k using errcode='22023';
      end if;
    end loop;
    if p_document->'presentation' ? 'signatures' and jsonb_typeof(p_document->'presentation'->'signatures') is distinct from 'boolean' then
      raise exception 'Invalid signatures setting' using errcode='22023';
    end if;
  end if;
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
    foreach k in array array['chapter','details'] loop
      if line ? k and (jsonb_typeof(line->k) is distinct from 'string'
        or length(line->>k) > case when k='chapter' then 200 else 2000 end) then
        raise exception 'Invalid work detail: %',k using errcode='22023';
      end if;
    end loop;
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
revoke all on function public.validate_billing_document(jsonb) from public,anon,authenticated;
commit;
