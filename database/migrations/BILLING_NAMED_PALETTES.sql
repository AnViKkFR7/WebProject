-- Apply after BILLING_APPEARANCE.sql. Documents keep their own color snapshots.
begin;

create table if not exists public.billing_color_palettes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (name=btrim(name) and length(name) between 1 and 60 and name !~ '[[:cntrl:]]'),
  palette jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists billing_color_palettes_name on public.billing_color_palettes(company_id,lower(name));
alter table public.billing_color_palettes enable row level security;
revoke all on public.billing_color_palettes from public,anon,authenticated;
grant select on public.billing_color_palettes to authenticated;
drop policy if exists billing_color_palettes_read on public.billing_color_palettes;
create policy billing_color_palettes_read on public.billing_color_palettes for select to authenticated
using (auth.uid() is not null and (public.is_platform_admin() or public.is_company_member(company_id)));

create or replace function public.save_billing_color_palette(p_company uuid,p_name text,p_palette jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.billing_color_palettes; clean_name text:=btrim(p_name);
begin
  perform public.assert_billing_access(p_company);
  if clean_name is null or length(clean_name) not between 1 and 60 or clean_name ~ '[[:cntrl:]]' then
    raise exception 'Invalid palette name' using errcode='22023';
  end if;
  perform public.validate_billing_palette(p_palette);
  if p_palette->>'id' <> 'custom' then raise exception 'Expected custom palette' using errcode='22023'; end if;
  insert into public.billing_color_palettes(company_id,name,palette,created_by)
    values(p_company,clean_name,p_palette,auth.uid())
    on conflict (company_id,lower(name)) do nothing returning * into result;
  if result.id is null then
    select * into result from public.billing_color_palettes where company_id=p_company and lower(name)=lower(clean_name);
    -- A retry of the same request returns the original entry, never a second palette.
    if result.palette is distinct from p_palette then raise exception 'Palette name already exists' using errcode='23505'; end if;
  end if;
  return to_jsonb(result);
end $$;
revoke all on function public.save_billing_color_palette(uuid,text,jsonb) from public,anon;
grant execute on function public.save_billing_color_palette(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
