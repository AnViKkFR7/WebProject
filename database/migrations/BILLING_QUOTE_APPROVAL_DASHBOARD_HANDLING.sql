-- Estado leído/tratado por usuario para respuestas recientes del dashboard.
-- Aplicar después de BILLING_QUOTE_APPROVAL_REVISIONS.sql.
begin;

create table if not exists public.quote_approval_response_handling (
  company_id uuid not null references public.companies(id) on delete cascade,
  response_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  handled_at timestamptz not null default now(),
  primary key(response_id,user_id),
  foreign key(response_id)
    references public.quote_approval_responses(id) on delete cascade
);

alter table public.quote_approval_response_handling enable row level security;
revoke all on public.quote_approval_response_handling from public,anon,authenticated;

create or replace function public.set_quote_approval_response_handled(
  p_user uuid,
  p_company uuid,
  p_response uuid,
  p_handled boolean default true
)
returns timestamptz
language plpgsql security definer set search_path='' set row_security=off as $$
declare result timestamptz;
module_enabled boolean;
begin
  if auth.uid() is null or p_user is distinct from auth.uid()
     or not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor','viewer']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if pg_catalog.to_regprocedure('public.is_company_module_enabled(uuid,text)') is not null then
    execute 'select public.is_company_module_enabled($1,$2)' into module_enabled using p_company,'billing';
    if not coalesce(module_enabled,true) then raise exception 'Billing module disabled' using errcode='42501'; end if;
  end if;

  if not exists(select 1 from public.quote_approval_responses r
    where r.company_id=p_company and r.id=p_response) then
    raise exception 'Quote response unavailable' using errcode='22023';
  end if;

  if coalesce(p_handled,true) then
    insert into public.quote_approval_response_handling(company_id,response_id,user_id)
    values(p_company,p_response,p_user)
    on conflict(response_id,user_id) do update set handled_at=now()
    returning handled_at into result;
    return result;
  end if;

  delete from public.quote_approval_response_handling h
    where h.company_id=p_company and h.response_id=p_response and h.user_id=p_user;
  return null;
end $$;

create or replace function public.get_company_recent_quote_approval_responses(p_company uuid,p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb; module_enabled boolean;
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin()
    or public.has_company_role(p_company,array['admin','editor','viewer']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if pg_catalog.to_regprocedure('public.is_company_module_enabled(uuid,text)') is not null then
    execute 'select public.is_company_module_enabled($1,$2)' into module_enabled using p_company,'billing';
    if not coalesce(module_enabled,true) then return '[]'::jsonb; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'response_id',r.id,
    'quote_id',r.quote_id,
    'quote_number',q.number,
    'decision',r.decision,
    'customer_name',r.declared_name,
    'responded_at',r.responded_at
  ) order by r.responded_at desc),'[]'::jsonb)
  into result
  from (
    select response.*
    from public.quote_approval_responses response
    where response.company_id=p_company
      and response.responded_at>=now()-interval '90 days'
      and not exists (
        select 1 from public.quote_approval_response_handling h
        where h.company_id=response.company_id
          and h.response_id=response.id
          and h.user_id=auth.uid()
      )
    order by response.responded_at desc
    limit greatest(1,least(coalesce(p_limit,5),10))
  ) r
  join public.quotes q on q.company_id=r.company_id and q.id=r.quote_id;
  return result;
end $$;

revoke all on function public.set_quote_approval_response_handled(uuid,uuid,uuid,boolean) from public,anon;
revoke all on function public.get_company_recent_quote_approval_responses(uuid,integer) from public,anon;
grant execute on function public.set_quote_approval_response_handled(uuid,uuid,uuid,boolean) to authenticated,service_role;
grant execute on function public.get_company_recent_quote_approval_responses(uuid,integer) to authenticated,service_role;

commit;
