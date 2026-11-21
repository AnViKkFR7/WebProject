-- Apply after ITEM_MEDIA_STORAGE, COMPANY_MEMBER_ACCESS and COMPANY_MODULES.
begin;
create or replace function public.set_item_cover(_item_id uuid, _media_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select i.company_id into tenant from public.items i where i.id=_item_id;
  if tenant is null or not coalesce(public.is_platform_admin() or public.has_company_role(tenant,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if not coalesce(public.is_company_module_enabled(tenant,'items'),false) then
    raise exception 'Company module is disabled' using errcode='42501';
  end if;
  -- Serialize cover switches for this item and keep its ownership stable.
  perform 1 from public.items where id=_item_id and company_id=tenant for update;
  if not found then raise exception 'Item changed; reload' using errcode='40001'; end if;
  perform 1 from public.item_media where item_id=_item_id order by id for update;
  if not exists(select 1 from public.item_media where id=_media_id and item_id=_item_id and file_type='image') then
    raise exception 'Cover must be an image of this item' using errcode='22023';
  end if;
  -- Two statements preserve compatibility with the existing per-row validator.
  update public.item_media set is_cover=false where item_id=_item_id and is_cover;
  update public.item_media set is_cover=true where id=_media_id and item_id=_item_id and file_type='image';
end $$;
revoke all on function public.set_item_cover(uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_item_cover(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
