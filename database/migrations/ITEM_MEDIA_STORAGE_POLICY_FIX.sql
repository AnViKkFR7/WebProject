-- items-media: cierra las políticas de Storage creadas a mano en el Dashboard.
-- Hallazgo G (auditoría 21/11/2026, deriva de producción): las políticas
-- "Authenticated users can upload and delete 14vvl3r_0/1/2" no filtran por
-- bucket ni empresa, así que cualquier usuario con sesión podía listar, subir
-- y borrar fotos y PDF del catálogo de otras empresas. "Public read access
-- 14vvl3r_0" dejaba además a anónimos listar el bucket.
--
-- El navegador nunca usa items-media directamente: suben, borran y limpian las
-- Edge Functions (upload-item-media, delete-item-media, cleanup-item-media) con
-- service_role, que no pasa por RLS y comprueba empresa, rol y módulo. Las URLs
-- públicas de las imágenes tampoco pasan por estas políticas.
-- Aplicar después de STORAGE_BUCKETS y BLOG_MEDIA_EDITOR. Idempotente.
begin;

drop policy if exists "Authenticated users can upload and delete 14vvl3r_0" on storage.objects;
drop policy if exists "Authenticated users can upload and delete 14vvl3r_1" on storage.objects;
drop policy if exists "Authenticated users can upload and delete 14vvl3r_2" on storage.objects;
drop policy if exists "Public read access 14vvl3r_0" on storage.objects;

-- Guardas restrictivas: aunque alguien vuelva a crear una política amplia en
-- el Dashboard, anon y authenticated no pueden tocar items-media por la API.
drop policy if exists items_media_read_guard on storage.objects;
create policy items_media_read_guard on storage.objects as restrictive for select to public
using(bucket_id <> 'items-media');
drop policy if exists items_media_insert_guard on storage.objects;
create policy items_media_insert_guard on storage.objects as restrictive for insert to public
with check(bucket_id <> 'items-media');
drop policy if exists items_media_update_guard on storage.objects;
create policy items_media_update_guard on storage.objects as restrictive for update to public
using(bucket_id <> 'items-media') with check(bucket_id <> 'items-media');
drop policy if exists items_media_delete_guard on storage.objects;
create policy items_media_delete_guard on storage.objects as restrictive for delete to public
using(bucket_id <> 'items-media');

commit;

-- Comprobación (debe devolver 0 filas):
-- select policyname from pg_policies where schemaname='storage' and tablename='objects'
--   and policyname ilike '%14vvl3r%';
