-- Enlaces públicos de aprobación/rechazo de presupuestos. Aplicar después de QUOTES.sql.
begin;

create unique index if not exists quotes_company_id_id_unique on public.quotes(company_id,id);

create table if not exists public.quote_approval_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null,
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  resolved_at timestamptz,
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade,
  unique(company_id,id)
);
create unique index if not exists quote_approval_one_active_per_quote
  on public.quote_approval_links(company_id,quote_id) where revoked_at is null and resolved_at is null;
create index if not exists quote_approval_links_expiry_idx on public.quote_approval_links(expires_at);

create or replace function public.revoke_stale_quote_approval_links()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status<>'sent' or old.document is distinct from new.document then
    update public.quote_approval_links set revoked_at=now()
      where company_id=new.company_id and quote_id=new.id and revoked_at is null and resolved_at is null;
  end if;
  return new;
end $$;
drop trigger if exists quotes_revoke_stale_approval_links on public.quotes;
create trigger quotes_revoke_stale_approval_links after update of status,document on public.quotes
for each row execute function public.revoke_stale_quote_approval_links();

create table if not exists public.quote_approval_responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null,
  link_id uuid not null,
  decision text not null check(decision in ('accepted','rejected')),
  declared_name text not null check(char_length(btrim(declared_name)) between 2 and 160),
  declared_email text not null check(char_length(btrim(declared_email)) between 3 and 254),
  reason text check(reason is null or char_length(reason)<=1000),
  responded_at timestamptz not null default now(),
  foreign key(company_id,quote_id) references public.quotes(company_id,id) on delete cascade,
  foreign key(company_id,link_id) references public.quote_approval_links(company_id,id) on delete cascade,
  unique(company_id,quote_id), unique(link_id)
);
alter table public.quote_approval_links enable row level security;
alter table public.quote_approval_responses enable row level security;
revoke all on public.quote_approval_links,public.quote_approval_responses from public,anon,authenticated;

create or replace function public.assert_quote_approval_module(p_company uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare enabled boolean;
begin
  if pg_catalog.to_regprocedure('public.is_company_module_enabled(uuid,text)') is not null then
    execute 'select public.is_company_module_enabled($1,$2)' into enabled using p_company,'billing';
    if not coalesce(enabled,true) then raise exception 'Billing module disabled' using errcode='42501'; end if;
  end if;
end $$;

create or replace function public.issue_quote_approval_link(
  p_company uuid,p_quote uuid,p_token_hash text,p_expires_at timestamptz
) returns timestamptz language plpgsql security definer set search_path='' set row_security=off as $$
declare result timestamptz;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_quote_approval_module(p_company);
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token hash' using errcode='22023'; end if;
  if p_expires_at is null or p_expires_at < now()+interval '1 day' or p_expires_at > now()+interval '90 days' then
    raise exception 'Expiry must be between 1 and 90 days' using errcode='22023';
  end if;
  perform 1 from public.quotes where company_id=p_company and id=p_quote and status='sent' for update;
  if not found then raise exception 'Only sent quotes can receive an approval link' using errcode='22023'; end if;
  update public.quote_approval_links set revoked_at=now()
    where company_id=p_company and quote_id=p_quote and revoked_at is null and resolved_at is null;
  insert into public.quote_approval_links(company_id,quote_id,token_hash,expires_at,issued_by)
    values(p_company,p_quote,p_token_hash,p_expires_at,auth.uid()) returning expires_at into result;
  return result;
end $$;

create or replace function public.get_quote_approval_details(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare link_row public.quote_approval_links; quote_row public.quotes; response_row public.quote_approval_responses;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into link_row from public.quote_approval_links where token_hash=p_token_hash and revoked_at is null;
  if not found or link_row.expires_at<=now() then return null; end if;
  perform public.assert_quote_approval_module(link_row.company_id);
  select * into quote_row from public.quotes where company_id=link_row.company_id and id=link_row.quote_id;
  if not found then return null; end if;
  select * into response_row from public.quote_approval_responses where link_id=link_row.id;
  return pg_catalog.jsonb_build_object(
    'number',quote_row.number,'status',quote_row.status,'document',quote_row.document,
    'expires_at',link_row.expires_at,'decision',response_row.decision,'responded_at',response_row.responded_at
  );
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
  -- Lock in the same order as issuance (quote, then link) to avoid deadlocks during reissue.
  select * into link_row from public.quote_approval_links where id=link_row.id and token_hash=p_token_hash and revoked_at is null for update;
  if not found or link_row.expires_at<=now() then raise exception 'Link expired or unavailable' using errcode='22023'; end if;
  select * into existing from public.quote_approval_responses where company_id=link_row.company_id and quote_id=link_row.quote_id;
  if found then return pg_catalog.jsonb_build_object('already_responded',true,'decision',existing.decision,'responded_at',existing.responded_at); end if;
  if quote_row.status<>'sent' then raise exception 'Quote is no longer awaiting a response' using errcode='22023'; end if;
  safe_reason:=nullif(btrim(p_reason),'');
  insert into public.quote_approval_responses(company_id,quote_id,link_id,decision,declared_name,declared_email,reason)
    values(link_row.company_id,link_row.quote_id,link_row.id,p_decision,btrim(p_name),lower(btrim(p_email)),safe_reason);
  update public.quote_approval_links set resolved_at=now() where id=link_row.id;
  update public.quote_approval_links set revoked_at=now() where company_id=link_row.company_id and quote_id=link_row.quote_id and id<>link_row.id and revoked_at is null;
  update public.quotes set status=p_decision,version=version+1,updated_at=now(),last_edited_by=quote_row.last_edited_by
    where company_id=link_row.company_id and id=link_row.quote_id;
  return pg_catalog.jsonb_build_object('already_responded',false,'decision',p_decision,'responded_at',now());
end $$;

create or replace function public.get_quote_approval_audit(p_company uuid,p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare link_items jsonb; response_item jsonb;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('issued_at',issued_at,'expires_at',expires_at,'revoked_at',revoked_at,'resolved_at',resolved_at) order by issued_at desc),'[]'::jsonb)
    into link_items from public.quote_approval_links where company_id=p_company and quote_id=p_quote;
  select to_jsonb(r) into response_item from public.quote_approval_responses r where company_id=p_company and quote_id=p_quote;
  return jsonb_build_object('links',link_items,'response',response_item);
end $$;

revoke all on function public.assert_quote_approval_module(uuid) from public,anon,authenticated;
revoke all on function public.revoke_stale_quote_approval_links() from public,anon,authenticated;
revoke all on function public.issue_quote_approval_link(uuid,uuid,text,timestamptz),public.get_quote_approval_details(text),public.respond_to_quote_approval(text,text,text,text,text),public.get_quote_approval_audit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_quote_approval_link(uuid,uuid,text,timestamptz),public.get_quote_approval_audit(uuid,uuid) to authenticated,service_role;
grant execute on function public.get_quote_approval_details(text),public.respond_to_quote_approval(text,text,text,text,text) to anon,authenticated,service_role;
commit;
