-- Permite responder de nuevo tras revisar un presupuesto rechazado y conserva cada respuesta por enlace.
-- Aplicar después de BILLING_QUOTE_APPROVAL.sql. No modifica migraciones previas.
begin;

do $$
declare constraint_name text;
begin
  select c.conname into constraint_name
  from pg_catalog.pg_constraint c
  where c.conrelid='public.quote_approval_responses'::regclass
    and c.contype='u'
    and (select array_agg(a.attname::text order by a.attname::text)
         from unnest(c.conkey) k(attnum)
         join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)
        = array['company_id','quote_id']::text[];
  if constraint_name is not null then
    execute format('alter table public.quote_approval_responses drop constraint %I',constraint_name);
  end if;
end $$;

create index if not exists quote_approval_responses_latest_idx
  on public.quote_approval_responses(company_id,quote_id,responded_at desc);
alter table public.quote_approval_links
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_provider_id text,
  add column if not exists company_notified_at timestamptz,
  add column if not exists company_notification_provider_id text;

create or replace function public.get_quote_approval_email_payload(p_user uuid,p_company uuid,p_quote uuid,p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare quote_row public.quotes; link_row public.quote_approval_links; company_name text; recipient text;
begin
  if not coalesce(p_user=auth.uid() and (public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor'])),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into quote_row from public.quotes where company_id=p_company and id=p_quote and status='sent';
  if not found then raise exception 'Only sent quotes can be emailed' using errcode='22023'; end if;
  select * into link_row from public.quote_approval_links where company_id=p_company and quote_id=p_quote
    and token_hash=p_token_hash and revoked_at is null and resolved_at is null and expires_at>now();
  if not found then raise exception 'Approval link unavailable' using errcode='22023'; end if;
  perform public.assert_quote_approval_module(p_company);
  recipient:=lower(btrim(coalesce(quote_row.document->'customer'->>'email','')));
  if recipient !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Customer email unavailable' using errcode='22023';
  end if;
  select c.name into company_name from public.companies c where c.id=p_company;
  return jsonb_build_object('link_id',link_row.id,'recipient_email',recipient,
    'recipient_name',coalesce(quote_row.document->'customer'->>'name',''),
    'company_name',coalesce(company_name,''),'quote_number',quote_row.number,'expires_at',link_row.expires_at);
end $$;

create or replace function public.mark_quote_approval_email_sent(p_user uuid,p_company uuid,p_quote uuid,p_link uuid,p_provider_id text default null)
returns timestamptz language plpgsql security definer set search_path='' set row_security=off as $$
declare sent_at timestamptz;
begin
  if not coalesce(p_user=auth.uid() and (public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor'])),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  update public.quote_approval_links set email_sent_at=now(),email_provider_id=nullif(left(p_provider_id,200),'')
    where company_id=p_company and quote_id=p_quote and id=p_link returning email_sent_at into sent_at;
  if not found then raise exception 'Approval link unavailable' using errcode='22023'; end if;
  return sent_at;
end $$;

create or replace function public.get_company_recent_quote_approval_responses(p_company uuid,p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb; module_enabled boolean;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor','viewer']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if pg_catalog.to_regprocedure('public.is_company_module_enabled(uuid,text)') is not null then
    execute 'select public.is_company_module_enabled($1,$2)' into module_enabled using p_company,'billing';
    if not coalesce(module_enabled,true) then return '[]'::jsonb; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('quote_id',r.quote_id,'quote_number',q.number,'decision',r.decision,
    'customer_name',r.declared_name,'responded_at',r.responded_at) order by r.responded_at desc),'[]'::jsonb)
    into result from (
      select * from public.quote_approval_responses where company_id=p_company
        and responded_at>=now()-interval '90 days' order by responded_at desc limit greatest(1,least(coalesce(p_limit,5),10))
    ) r join public.quotes q on q.company_id=r.company_id and q.id=r.quote_id;
  return result;
end $$;

-- This payload is only for the service-role Edge Function called after a public response.
create or replace function public.get_quote_approval_notification_payload(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare link_row public.quote_approval_links; response_row public.quote_approval_responses; quote_row public.quotes; admins text[];
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into link_row from public.quote_approval_links where token_hash=p_token_hash and resolved_at is not null;
  if not found then return null; end if;
  select * into response_row from public.quote_approval_responses where link_id=link_row.id;
  select * into quote_row from public.quotes where company_id=link_row.company_id and id=link_row.quote_id;
  if not found then return null; end if;
  select coalesce(array_agg(distinct u.email order by u.email),array[]::text[]) into admins
    from public.company_members m join auth.users u on u.id=m.user_id
    where m.company_id=link_row.company_id and m.role='admin' and m.is_active and u.email is not null;
  return jsonb_build_object('link_id',link_row.id,'response_id',response_row.id,'quote_id',quote_row.id,'quote_number',quote_row.number,
    'company_id',link_row.company_id,'company_name',coalesce((select c.name from public.companies c where c.id=link_row.company_id),''),
    'recipient_emails',admins,'decision',response_row.decision,'already_notified',link_row.company_notified_at is not null,'customer_name',response_row.declared_name,
    'customer_email',response_row.declared_email,'responded_at',response_row.responded_at);
end $$;

create or replace function public.mark_quote_approval_notification_sent(p_link uuid,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
begin
  update public.quote_approval_links set company_notified_at=now(),company_notification_provider_id=nullif(left(p_provider_id,200),'')
    where id=p_link and resolved_at is not null and company_notified_at is null;
  return found;
end $$;

create or replace function public.respond_to_quote_approval(
  p_token_hash text,p_decision text,p_name text,p_email text,p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare link_row public.quote_approval_links; quote_row public.quotes; existing public.quote_approval_responses; safe_reason text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid link' using errcode='22023'; end if;
  if p_decision not in ('accepted','rejected') then raise exception 'Invalid decision' using errcode='22023'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 160 then raise exception 'Enter your name' using errcode='22023'; end if;
  if p_email is null or char_length(btrim(p_email)) not between 3 and 254 or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email' using errcode='22023'; end if;
  if p_reason is not null and char_length(p_reason)>1000 then raise exception 'Reason is too long' using errcode='22023'; end if;
  select * into link_row from public.quote_approval_links where token_hash=p_token_hash and revoked_at is null;
  if not found or link_row.expires_at<=now() then raise exception 'Link expired or unavailable' using errcode='22023'; end if;
  perform public.assert_quote_approval_module(link_row.company_id);
  select * into quote_row from public.quotes where company_id=link_row.company_id and id=link_row.quote_id for update;
  if not found then raise exception 'Quote unavailable' using errcode='22023'; end if;
  -- Lock the link after the quote, matching issuance order and serializing duplicate submits.
  select * into link_row from public.quote_approval_links where id=link_row.id and token_hash=p_token_hash and revoked_at is null for update;
  if not found or link_row.expires_at<=now() then raise exception 'Link expired or unavailable' using errcode='22023'; end if;
  select * into existing from public.quote_approval_responses where link_id=link_row.id;
  if found then return pg_catalog.jsonb_build_object('already_responded',true,'decision',existing.decision,'responded_at',existing.responded_at); end if;
  if link_row.resolved_at is not null then raise exception 'Link already resolved' using errcode='22023'; end if;
  if quote_row.status<>'sent' then raise exception 'Quote is no longer awaiting a response' using errcode='22023'; end if;
  safe_reason:=nullif(btrim(p_reason),'');
  insert into public.quote_approval_responses(company_id,quote_id,link_id,decision,declared_name,declared_email,reason)
    values(link_row.company_id,link_row.quote_id,link_row.id,p_decision,btrim(p_name),lower(btrim(p_email)),safe_reason)
    returning * into existing;
  update public.quote_approval_links set resolved_at=now() where id=link_row.id;
  update public.quote_approval_links set revoked_at=now()
    where company_id=link_row.company_id and quote_id=link_row.quote_id and id<>link_row.id and revoked_at is null and resolved_at is null;
  update public.quotes set status=p_decision,version=version+1,updated_at=now(),last_edited_by=quote_row.last_edited_by
    where company_id=link_row.company_id and id=link_row.quote_id;
  return pg_catalog.jsonb_build_object('already_responded',false,'decision',p_decision,'responded_at',existing.responded_at);
end $$;

create or replace function public.get_quote_approval_audit(p_company uuid,p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare link_items jsonb; response_item jsonb; response_items jsonb; current_status text; current_version integer;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('issued_at',issued_at,'expires_at',expires_at,'revoked_at',revoked_at,'resolved_at',resolved_at,
    'email_sent_at',email_sent_at,'company_notified_at',company_notified_at) order by issued_at desc),'[]'::jsonb)
    into link_items from public.quote_approval_links where company_id=p_company and quote_id=p_quote;
  select q.status,q.version into current_status,current_version from public.quotes q where company_id=p_company and id=p_quote;
  select to_jsonb(r) into response_item from public.quote_approval_responses r
    where company_id=p_company and quote_id=p_quote order by responded_at desc limit 1;
  select coalesce(jsonb_agg(to_jsonb(r) order by responded_at desc),'[]'::jsonb) into response_items
    from public.quote_approval_responses r where company_id=p_company and quote_id=p_quote;
  return jsonb_build_object('links',link_items,'response',response_item,'responses',response_items,'quote_status',current_status,'quote_version',current_version);
end $$;

revoke all on function public.respond_to_quote_approval(text,text,text,text,text),public.get_quote_approval_audit(uuid,uuid),
  public.get_quote_approval_email_payload(uuid,uuid,uuid,text),public.mark_quote_approval_email_sent(uuid,uuid,uuid,uuid,text),
  public.get_quote_approval_notification_payload(text),public.mark_quote_approval_notification_sent(uuid,text),
  public.get_company_recent_quote_approval_responses(uuid,integer) from public,anon,authenticated;
grant execute on function public.respond_to_quote_approval(text,text,text,text,text) to anon,authenticated,service_role;
grant execute on function public.get_quote_approval_audit(uuid,uuid),public.get_quote_approval_email_payload(uuid,uuid,uuid,text),
  public.mark_quote_approval_email_sent(uuid,uuid,uuid,uuid,text),public.get_company_recent_quote_approval_responses(uuid,integer) to authenticated,service_role;
grant execute on function public.get_quote_approval_notification_payload(text),public.mark_quote_approval_notification_sent(uuid,text) to service_role;
commit;
