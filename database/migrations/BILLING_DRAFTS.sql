-- After BILLING_APPEARANCE.sql. Recovery copies never consume invoice/quote numbers.
begin;
create table if not exists public.billing_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('invoice','quote')),
  document_key text not null,
  document jsonb not null,
  base_version integer,
  version integer not null default 1,
  last_write uuid not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  unique(company_id,owner_id,kind,document_key)
);
create table if not exists public.billing_draft_events (
  id bigint generated always as identity primary key,
  draft_id uuid not null, company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null, actor_id uuid not null,
  action text not null, revision integer not null, created_at timestamptz not null default now()
);
create table if not exists public.billing_draft_commits (
  request_id uuid primary key, company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null, kind text not null, record_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.billing_drafts enable row level security;
alter table public.billing_draft_events enable row level security;
alter table public.billing_draft_commits enable row level security;
revoke all on public.billing_drafts,public.billing_draft_events,public.billing_draft_commits from public,anon,authenticated;
grant select on public.billing_drafts to authenticated;
drop policy if exists billing_drafts_read on public.billing_drafts;
create policy billing_drafts_read on public.billing_drafts for select to authenticated
using(owner_id=auth.uid() and expires_at>now() and (public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor'])));

create or replace function public.validate_billing_draft(p_document jsonb)
returns void language plpgsql set search_path='' as $$
declare k text; item jsonb; value jsonb;
begin
  if p_document is null or jsonb_typeof(p_document)<>'object' or octet_length(p_document::text)>2000000 then
    raise exception 'Invalid recovery document' using errcode='22023';
  end if;
  -- JSON only, with bounded editable strings/numbers; incomplete/invalid form values are recoverable.
  if jsonb_typeof(p_document->'issuer') is distinct from 'object' or jsonb_typeof(p_document->'customer') is distinct from 'object'
    or jsonb_typeof(p_document->'lines') is distinct from 'array' then raise exception 'Invalid draft structure' using errcode='22023'; end if;
  if jsonb_array_length(p_document->'lines')>1000 then raise exception 'Too many draft lines' using errcode='22023'; end if;
  for k,value in select * from jsonb_each(p_document->'issuer') loop
    if k='palette' then
      if jsonb_typeof(value)<>'object' or octet_length(value::text)>1000 then raise exception 'Invalid draft palette' using errcode='22023'; end if;
      for item in select v from jsonb_each(value) e(k,v) loop
        if jsonb_typeof(item)<>'string' or length(item#>>'{}')>32 then raise exception 'Invalid draft palette value' using errcode='22023'; end if;
      end loop;
    elsif k='logo' then
      if jsonb_typeof(value)<>'string' or length(value#>>'{}')>1400000 or ((value#>>'{}')<>'' and (value#>>'{}') !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$') then
        raise exception 'Invalid draft logo' using errcode='22023'; end if;
    elsif jsonb_typeof(value)<>'string' or length(value#>>'{}')>2000 then raise exception 'Invalid draft issuer' using errcode='22023'; end if;
  end loop;
  for value in select v from jsonb_each(p_document->'customer') e(k,v) loop
    if jsonb_typeof(value)<>'string' or length(value#>>'{}')>2000 then raise exception 'Invalid draft customer' using errcode='22023'; end if;
  end loop;
  for item in select * from jsonb_array_elements(p_document->'lines') loop
    if jsonb_typeof(item)<>'object' then raise exception 'Invalid draft line' using errcode='22023'; end if;
    for value in select v from jsonb_each(item) e(k,v) loop
      if jsonb_typeof(value) not in ('string','number') or length(value#>>'{}')>2000 then raise exception 'Invalid draft line field' using errcode='22023'; end if;
    end loop;
  end loop;
  for k,value in select * from jsonb_each(p_document) loop
    if k in ('issuer','customer','lines') then continue;
    elsif k='presentation' then
      if jsonb_typeof(value)<>'object' then raise exception 'Invalid draft presentation' using errcode='22023'; end if;
      for item in select v from jsonb_each(value) e(k,v) loop
        if jsonb_typeof(item) not in ('string','boolean') or length(item#>>'{}')>2000 then raise exception 'Invalid draft presentation field' using errcode='22023'; end if;
      end loop;
    elsif jsonb_typeof(value) not in ('string','number') or length(value#>>'{}')>2000 then raise exception 'Invalid draft field' using errcode='22023'; end if;
  end loop;
end $$;

create or replace function public.get_billing_draft(p_company uuid,p_kind text,p_key text,p_previous uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.billing_drafts; completed jsonb; previous public.billing_draft_commits;
begin
  perform public.assert_billing_access(p_company);
  select * into result from public.billing_drafts where company_id=p_company and owner_id=auth.uid() and kind=p_kind and document_key=p_key and expires_at>now();
  select * into previous from public.billing_draft_commits where request_id=p_previous and company_id=p_company and owner_id=auth.uid() and kind=p_kind and created_at>now()-interval '30 days';
  if previous.request_id is not null then
    if p_kind='invoice' then select to_jsonb(i) into completed from public.invoices i where id=previous.record_id and company_id=p_company;
    else select to_jsonb(q) into completed from public.quotes q where id=previous.record_id and company_id=p_company; end if;
  end if;
  return case when result.id is not null then to_jsonb(result)||jsonb_build_object('completed_record',completed)
    when completed is not null then jsonb_build_object('completed_record',completed) else null end;
end $$;

create or replace function public.save_billing_draft(p_company uuid,p_kind text,p_key text,p_document jsonb,p_base_version integer,p_version integer,p_write uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.billing_drafts; source_version integer; source_status text; source_id uuid;
begin
  perform public.assert_billing_access(p_company);
  if p_kind not in ('invoice','quote') or p_kind is null or p_write is null or p_version is null or p_version<0 or p_key is null then
    raise exception 'Invalid draft scope' using errcode='22023'; end if;
  perform public.validate_billing_draft(p_document);
  -- All operations on a user's slot serialize, including final save and retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||auth.uid()::text||p_kind||p_key,0));
  if p_key='new' then
    if p_base_version is not null then raise exception 'Invalid new document version' using errcode='22023'; end if;
  else
    begin source_id:=p_key::uuid; exception when others then raise exception 'Invalid document key' using errcode='22023'; end;
    if p_kind='invoice' then select version,status into source_version,source_status from public.invoices where company_id=p_company and id=source_id for update;
    else select version,status into source_version,source_status from public.quotes where company_id=p_company and id=source_id for update; end if;
    if source_version is null or source_version is distinct from p_base_version or source_status<>'draft' then raise exception 'Source document changed' using errcode='40001'; end if;
  end if;
  select * into result from public.billing_drafts where company_id=p_company and owner_id=auth.uid() and kind=p_kind and document_key=p_key for update;
  if result.id is not null and result.expires_at<=now() then delete from public.billing_drafts where id=result.id; result:=null; end if;
  if result.id is not null and result.last_write=p_write and result.document=p_document and result.base_version is not distinct from p_base_version then return to_jsonb(result); end if;
  if result.id is null then
    if p_version<>0 then raise exception 'Draft changed' using errcode='40001'; end if;
    insert into public.billing_drafts(company_id,owner_id,kind,document_key,document,base_version,last_write)
      values(p_company,auth.uid(),p_kind,p_key,p_document,p_base_version,p_write) returning * into result;
  else
    if result.version<>p_version then raise exception 'Draft changed' using errcode='40001'; end if;
    update public.billing_drafts set document=p_document,base_version=p_base_version,version=version+1,last_write=p_write,
      updated_at=now(),expires_at=now()+interval '30 days' where id=result.id returning * into result;
  end if;
  insert into public.billing_draft_events(draft_id,company_id,owner_id,actor_id,action,revision)
    values(result.id,p_company,auth.uid(),auth.uid(),'saved',result.version);
  return to_jsonb(result);
end $$;

create or replace function public.delete_billing_draft(p_company uuid,p_kind text,p_key text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare result public.billing_drafts;
begin
  perform public.assert_billing_access(p_company);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||auth.uid()::text||p_kind||p_key,0));
  delete from public.billing_drafts where company_id=p_company and owner_id=auth.uid() and kind=p_kind and document_key=p_key and version=p_version returning * into result;
  if result.id is null then raise exception 'Draft changed' using errcode='40001'; end if;
  insert into public.billing_draft_events(draft_id,company_id,owner_id,actor_id,action,revision)
    values(result.id,p_company,auth.uid(),auth.uid(),'discarded',result.version);
end $$;

create or replace function public.commit_billing_draft(p_company uuid,p_kind text,p_key text,p_request uuid,p_version integer,p_document jsonb,p_status text,p_invoice_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare draft public.billing_drafts; previous public.billing_draft_commits; result jsonb;
begin
  perform public.assert_billing_access(p_company);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||auth.uid()::text||p_kind||p_key,0));
  select * into previous from public.billing_draft_commits where request_id=p_request;
  if previous.request_id is not null then
    if previous.company_id<>p_company or previous.owner_id<>auth.uid() or previous.kind<>p_kind then raise exception 'Forbidden' using errcode='42501'; end if;
    if p_kind='invoice' then select to_jsonb(i) into result from public.invoices i where id=previous.record_id and company_id=p_company;
    else select to_jsonb(q) into result from public.quotes q where id=previous.record_id and company_id=p_company; end if;
    if result->'document' is distinct from p_document or result->>'status' is distinct from p_status then raise exception 'Completed document changed' using errcode='40001'; end if;
    return result;
  end if;
  select * into draft from public.billing_drafts where company_id=p_company and owner_id=auth.uid() and kind=p_kind and document_key=p_key for update;
  if draft.id is null or draft.id is distinct from p_request or draft.version is distinct from p_version or draft.expires_at<=now()
    or draft.base_version is distinct from p_invoice_version then raise exception 'Draft changed' using errcode='40001'; end if;
  if p_key<>'new' then
    if p_kind='invoice' then perform 1 from public.invoices where company_id=p_company and id=p_key::uuid and version=p_invoice_version and status='draft' for update;
    else perform 1 from public.quotes where company_id=p_company and id=p_key::uuid and version=p_invoice_version and status='draft' for update; end if;
    if not found then raise exception 'Source document changed' using errcode='40001'; end if;
  end if;
  if p_kind='invoice' then result:=to_jsonb(public.save_invoice(p_company,p_document,p_status,case when p_key='new' then null else p_key::uuid end,p_invoice_version));
  elsif p_kind='quote' then result:=to_jsonb(public.save_quote(p_company,p_document,p_status,case when p_key='new' then null else p_key::uuid end,p_invoice_version));
  else raise exception 'Invalid document kind' using errcode='22023'; end if;
  insert into public.billing_draft_commits(request_id,company_id,owner_id,kind,record_id) values(p_request,p_company,auth.uid(),p_kind,(result->>'id')::uuid);
  insert into public.billing_draft_events(draft_id,company_id,owner_id,actor_id,action,revision) values(draft.id,p_company,auth.uid(),auth.uid(),'committed',draft.version);
  delete from public.billing_drafts where id=draft.id;
  return result;
end $$;

create or replace function public.purge_billing_recovery()
returns void language sql security definer set search_path='' as $$
  delete from public.billing_drafts where expires_at<=now();
  delete from public.billing_draft_events where created_at<now()-interval '90 days';
  delete from public.billing_draft_commits where created_at<now()-interval '30 days';
$$;
revoke all on function public.validate_billing_draft(jsonb),public.purge_billing_recovery() from public,anon,authenticated;
revoke all on function public.get_billing_draft(uuid,text,text,uuid),public.save_billing_draft(uuid,text,text,jsonb,integer,integer,uuid),public.delete_billing_draft(uuid,text,text,integer),public.commit_billing_draft(uuid,text,text,uuid,integer,jsonb,text,integer) from public,anon;
grant execute on function public.get_billing_draft(uuid,text,text,uuid),public.save_billing_draft(uuid,text,text,jsonb,integer,integer,uuid),public.delete_billing_draft(uuid,text,text,integer),public.commit_billing_draft(uuid,text,text,uuid,integer,jsonb,text,integer) to authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.purge_billing_recovery() to service_role; end if; end $$;
notify pgrst,'reload schema';
commit;
