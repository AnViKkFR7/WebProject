-- After BILLING_DIRECTORY_CATALOG.sql. Reusable quote chapter snapshots.
begin;
create table if not exists public.billing_chapter_templates(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  lines jsonb not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index if not exists billing_chapter_template_active_name_unique
  on public.billing_chapter_templates(company_id,lower(name)) where archived_at is null;
alter table public.billing_chapter_templates enable row level security;
revoke all on public.billing_chapter_templates from public,anon,authenticated;
grant select on public.billing_chapter_templates to authenticated;
drop policy if exists billing_chapter_template_read on public.billing_chapter_templates;
create policy billing_chapter_template_read on public.billing_chapter_templates for select to authenticated
using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor','viewer']));

create or replace function public.valid_billing_template_lines(p_lines jsonb)
returns boolean language sql immutable set search_path='' as $$
  select jsonb_typeof(p_lines)='array' and jsonb_array_length(p_lines) between 1 and 200
    and not exists(select 1 from jsonb_array_elements(p_lines) line where
      length(coalesce(line->>'id','')) not between 1 and 100
      or length(trim(coalesce(line->>'chapter',''))) not between 1 and 200
      or length(trim(coalesce(line->>'description',''))) not between 1 and 2000
      or length(coalesce(line->>'details',''))>2000
      or coalesce((line->>'quantity')::numeric,0)<=0 or coalesce((line->>'quantity')::numeric,0)>1000000000
      or coalesce((line->>'price')::numeric,-1)<0 or coalesce((line->>'price')::numeric,-1)>1000000000
      or coalesce((line->>'discount')::numeric,-1) not between 0 and 100
      or coalesce((line->>'tax')::numeric,-1) not between 0 and 100);
$$;
create or replace function public.save_billing_chapter_template(p_company uuid,p_name text,p_lines jsonb)
returns public.billing_chapter_templates language plpgsql security definer set search_path='' as $$
declare result public.billing_chapter_templates;
begin
  perform public.assert_billing_access(p_company);p_name:=trim(coalesce(p_name,''));
  if length(p_name) not between 1 and 100 or not public.valid_billing_template_lines(p_lines) then raise exception 'Invalid chapter template' using errcode='22023';end if;
  insert into public.billing_chapter_templates(company_id,name,lines,created_by,updated_by)
  values(p_company,p_name,p_lines,auth.uid(),auth.uid()) returning * into result;
  return result;
exception when unique_violation then raise exception 'Template name already exists' using errcode='23505';
end $$;
create or replace function public.archive_billing_chapter_template(p_company uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_billing_access(p_company);
  update public.billing_chapter_templates set archived_at=now(),updated_at=now(),updated_by=auth.uid()
    where id=p_id and company_id=p_company and archived_at is null;
  if not found then raise exception 'Template changed or unavailable' using errcode='40001';end if;
end $$;
revoke all on function public.valid_billing_template_lines(jsonb),public.save_billing_chapter_template(uuid,text,jsonb),public.archive_billing_chapter_template(uuid,uuid) from public,anon;
grant execute on function public.save_billing_chapter_template(uuid,text,jsonb),public.archive_billing_chapter_template(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
