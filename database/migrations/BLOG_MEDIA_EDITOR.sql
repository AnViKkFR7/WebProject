-- Blog: imágenes (hasta 3 por artículo) subidas desde el panel.
-- Aplicar después de CONTENT_SEO_FIELDS, RLS_ADMIN_WRITE_FIX, STORAGE_BUCKETS,
-- COMPANY_MODULES e ITEM_STORAGE_CLEANUP_QUEUE. No modifica artículos ni
-- imágenes existentes; solo valida las que se añadan o cambien a partir de ahora.
--
-- Rutas en Storage: blog-media/<empresa>/<artículo>/<archivo>.webp
-- El navegador sube directamente; Storage comprueba en el servidor que quien
-- sube es admin/editor de ESA empresa, que el artículo es de esa empresa y que
-- el módulo Blog está activo. No hay Edge Function ni service_role implicada.
begin;

-- 1) Bucket público (las webs muestran las imágenes por URL) con límites.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('blog-media','blog-media',true,5242880,array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- 2) ¿Puede el usuario actual escribir este objeto?
create or replace function public.can_write_blog_object(p_name text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  parts text[]:=pg_catalog.string_to_array(p_name,'/');
  uuid_re constant text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  tenant uuid;
begin
  if auth.uid() is null or pg_catalog.array_length(parts,1)<>3 then return false; end if;
  if parts[1] !~ uuid_re or parts[2] !~ uuid_re or parts[3] !~ '^[A-Za-z0-9_-]{1,120}\.(webp|jpe?g|png)$' then return false; end if;
  tenant:=parts[1]::uuid;
  if not exists(select 1 from public.blog_posts p where p.id=parts[2]::uuid and p.company_id=tenant) then return false; end if;
  if not public.is_company_module_enabled(tenant,'blog') then return false; end if;
  return public.is_platform_admin() or public.has_company_role(tenant,array['admin','editor']);
end $$;
revoke all on function public.can_write_blog_object(text) from public;
grant execute on function public.can_write_blog_object(text) to authenticated,anon;

-- 3) Políticas. Las restrictivas protegen el bucket aunque exista alguna
--    política antigua demasiado amplia; las permisivas dan el acceso.
drop policy if exists blog_media_insert_guard on storage.objects;
create policy blog_media_insert_guard on storage.objects as restrictive for insert to public
with check(bucket_id <> 'blog-media' or public.can_write_blog_object(name));
drop policy if exists blog_media_update_guard on storage.objects;
create policy blog_media_update_guard on storage.objects as restrictive for update to public
using(bucket_id <> 'blog-media' or public.can_write_blog_object(name))
with check(bucket_id <> 'blog-media' or public.can_write_blog_object(name));
drop policy if exists blog_media_delete_guard on storage.objects;
create policy blog_media_delete_guard on storage.objects as restrictive for delete to public
using(bucket_id <> 'blog-media' or public.can_write_blog_object(name));

-- Lectura vía API solo para quien escribe (la necesita Storage para borrar).
-- El público ve las imágenes por su URL pública, que no pasa por estas políticas.
drop policy if exists blog_media_select on storage.objects;
create policy blog_media_select on storage.objects for select to authenticated
using(bucket_id='blog-media' and public.can_write_blog_object(name));
drop policy if exists blog_media_insert on storage.objects;
create policy blog_media_insert on storage.objects for insert to authenticated
with check(bucket_id='blog-media' and public.can_write_blog_object(name));
drop policy if exists blog_media_update on storage.objects;
create policy blog_media_update on storage.objects for update to authenticated
using(bucket_id='blog-media' and public.can_write_blog_object(name))
with check(bucket_id='blog-media' and public.can_write_blog_object(name));
drop policy if exists blog_media_delete on storage.objects;
create policy blog_media_delete on storage.objects for delete to authenticated
using(bucket_id='blog-media' and public.can_write_blog_object(name));

-- 4) Reglas de blog_media, comprobadas en el servidor.
create or replace function public.validate_blog_media()
returns trigger language plpgsql set search_path='' as $$
declare tenant uuid;
begin
  if tg_op='UPDATE' and new.post_id is distinct from old.post_id then
    raise exception 'Una imagen no puede cambiar de artículo' using errcode='22023';
  end if;
  -- Bloquea el artículo: dos subidas simultáneas no pueden saltarse el límite.
  select p.company_id into tenant from public.blog_posts p where p.id=new.post_id for update;
  if tenant is null then raise exception 'Artículo no encontrado' using errcode='23503'; end if;
  if new.file_type<>'image' then raise exception 'El blog solo admite imágenes' using errcode='22023'; end if;
  if tg_op='INSERT' or new.url_externa is distinct from old.url_externa then
    if new.url_externa !~ ('^https://[^/?#]+/storage/v1/object/public/blog-media/'||tenant::text||'/'||new.post_id::text||'/[A-Za-z0-9_-]{1,120}\.(webp|jpe?g|png)$') then
      raise exception 'La imagen debe estar en la carpeta de este artículo' using errcode='42501';
    end if;
  end if;
  if tg_op='INSERT' and (select pg_catalog.count(*) from public.blog_media m where m.post_id=new.post_id and m.file_type='image')>=3 then
    raise exception 'Máximo 3 imágenes por artículo' using errcode='23514';
  end if;
  if new.is_cover_image and (tg_op='INSERT' or not old.is_cover_image)
     and exists(select 1 from public.blog_media m where m.post_id=new.post_id and m.is_cover_image and m.id<>new.id) then
    raise exception 'Solo puede haber una portada por artículo' using errcode='23505';
  end if;
  return new;
end $$;
revoke all on function public.validate_blog_media() from public,anon,authenticated;
drop trigger if exists validate_blog_media on public.blog_media;
create trigger validate_blog_media before insert or update on public.blog_media
for each row execute function public.validate_blog_media();

-- Texto alternativo razonable (no valida filas antiguas).
do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.blog_media'::regclass and conname='blog_media_alt_text_length') then
    alter table public.blog_media add constraint blog_media_alt_text_length
      check(alt_text is null or char_length(alt_text)<=250) not valid;
  end if;
end $$;
create index if not exists blog_media_post_order on public.blog_media(post_id,sort_order);
commit;
