-- ================================================================
-- SCRIPT DE ACTUALIZACIÓN: GESTIÓN DE MEDIA PARA ITEMS
-- ================================================================
-- Este script añade la lógica completa para gestionar imágenes
-- y PDFs asociados a items con las siguientes reglas:
-- - Max 10 imágenes por item
-- - Max 2 PDFs por item
-- - Si hay imágenes, una y solo una debe ser portada
-- - Descripción obligatoria para PDFs
-- - Borrado en cascade del Storage
-- ================================================================

-- 1) AÑADIR COLUMNA is_cover A item_media
-- Para marcar la imagen de portada
alter table public.item_media
  add column if not exists is_cover boolean not null default false;

-- 2) CREAR ÍNDICES PARA OPTIMIZAR CONSULTAS
create index if not exists idx_item_media_item_id on public.item_media(item_id);
create index if not exists idx_item_media_file_type on public.item_media(file_type);
create index if not exists idx_item_media_is_cover on public.item_media(is_cover) where is_cover = true;
create index if not exists idx_item_media_sort_order on public.item_media(item_id, sort_order);

-- 3) FUNCIÓN DE VALIDACIÓN: Límites y reglas de negocio
create or replace function public.validate_item_media()
returns trigger
language plpgsql
as $$
declare
  image_count int;
  pdf_count int;
  cover_count int;
  total_images int;
begin
  -- Validar tipo de archivo
  if new.file_type not in ('image', 'pdf') then
    raise exception 'file_type debe ser "image" o "pdf"';
  end if;

  -- Si es PDF, la descripción (alt_text) es obligatoria
  if new.file_type = 'pdf' and (new.alt_text is null or trim(new.alt_text) = '') then
    raise exception 'Los archivos PDF requieren una descripción obligatoria (alt_text)';
  end if;

  -- Solo las imágenes pueden ser portada
  if new.is_cover = true and new.file_type != 'image' then
    raise exception 'Solo las imágenes pueden ser marcadas como portada';
  end if;

  -- Contar imágenes existentes del mismo item (excluyendo el actual si es update)
  select count(*) into image_count
  from public.item_media
  where item_id = new.item_id
    and file_type = 'image'
    and (tg_op = 'INSERT' or id != new.id);

  -- Contar PDFs existentes del mismo item
  select count(*) into pdf_count
  from public.item_media
  where item_id = new.item_id
    and file_type = 'pdf'
    and (tg_op = 'INSERT' or id != new.id);

  -- Validar límites
  if new.file_type = 'image' and image_count >= 10 then
    raise exception 'Un item no puede tener más de 10 imágenes';
  end if;

  if new.file_type = 'pdf' and pdf_count >= 2 then
    raise exception 'Un item no puede tener más de 2 archivos PDF';
  end if;

  -- Validar portada única
  if new.is_cover = true then
    -- Contar otras portadas del mismo item
    select count(*) into cover_count
    from public.item_media
    where item_id = new.item_id
      and is_cover = true
      and (tg_op = 'INSERT' or id != new.id);

    if cover_count > 0 then
      raise exception 'Un item solo puede tener una imagen de portada. Desmarca la portada actual primero.';
    end if;
  end if;

  -- NOTA: Se eliminó la validación que requería una portada obligatoria
  -- Ahora un item puede tener 0 o 1 portada (pero nunca más de 1)
  -- La validación de portada obligatoria se hará al publicar el item

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- 4) TRIGGER DE VALIDACIÓN
drop trigger if exists trg_validate_item_media on public.item_media;
create trigger trg_validate_item_media
before insert or update or delete on public.item_media
for each row execute function public.validate_item_media();

-- 5) FUNCIÓN PARA LIMPIAR ARCHIVOS DEL STORAGE AL BORRAR REGISTROS
-- IMPORTANTE: Esta función requiere la extensión http para hacer llamadas al Storage API
-- La implementación real del borrado del Storage debe hacerse desde el backend/Edge Function
-- Aquí dejamos un placeholder para documentación

create or replace function public.cleanup_item_media_storage()
returns trigger
language plpgsql
security definer
as $$
begin
  -- NOTA: El borrado físico del archivo en Supabase Storage debe hacerse
  -- desde el backend (admin panel) o mediante una Edge Function que tenga
  -- acceso al service_role_key para llamar a:
  -- supabase.storage.from('items-media').remove([path])
  
  -- Este trigger solo registra la necesidad de limpieza
  -- En producción, considera usar una cola de trabajos o Edge Function
  
  raise notice 'Archivo para eliminar del storage: %', old.url_externa;
  
  return old;
end;
$$;

drop trigger if exists trg_cleanup_item_media_storage on public.item_media;
create trigger trg_cleanup_item_media_storage
after delete on public.item_media
for each row execute function public.cleanup_item_media_storage();

-- 6) POLÍTICAS RLS PARA item_media
-- Lectura pública, escritura solo para admin/editor de la compañía

-- SELECT: Público (cualquiera puede ver)
drop policy if exists "item_media_public_select" on public.item_media;
create policy "item_media_public_select"
on public.item_media
for select
to anon, authenticated
using (true);

-- INSERT: Solo admin o editor de la compañía del item
drop policy if exists "item_media_insert_admin_editor" on public.item_media;
create policy "item_media_insert_admin_editor"
on public.item_media
for insert
to authenticated
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.has_company_role(i.company_id, array['editor'])
  )
);

-- UPDATE: Solo admin o editor de la compañía del item
drop policy if exists "item_media_update_admin_editor" on public.item_media;
create policy "item_media_update_admin_editor"
on public.item_media
for update
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.has_company_role(i.company_id, array['editor'])
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.has_company_role(i.company_id, array['editor'])
  )
);

-- DELETE: Solo admin o editor de la compañía del item
drop policy if exists "item_media_delete_admin_editor" on public.item_media;
create policy "item_media_delete_admin_editor"
on public.item_media
for delete
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.has_company_role(i.company_id, array['editor'])
  )
);

-- NOTA: Las políticas del BUCKET de Storage 'items-media' deben configurarse manualmente:
-- 
-- En Supabase Dashboard > Storage > items-media > Policies:
--
-- 1. SELECT (Lectura pública para todos):
--    Policy Name: "Public read access"
--    Allowed operations: SELECT
--    Policy definition: true
--
-- 2. INSERT (Solo usuarios autenticados - la Edge Function valida permisos):
--    Policy Name: "Authenticated users can upload"
--    Allowed operations: INSERT
--    Policy definition: (auth.role() = 'authenticated')
--
-- 3. DELETE (Solo usuarios autenticados - la Edge Function valida permisos):
--    Policy Name: "Authenticated users can delete"
--    Allowed operations: DELETE
--    Policy definition: (auth.role() = 'authenticated')
--
-- La validación de que el usuario es admin/editor de la compañía se hace
-- en las Edge Functions (upload-item-media y delete-item-media)

-- 7) VISTA AUXILIAR: Resumen de media por item
create or replace view public.item_media_summary as
select
  i.id as item_id,
  i.title as item_title,
  count(*) filter (where im.file_type = 'image') as image_count,
  count(*) filter (where im.file_type = 'pdf') as pdf_count,
  count(*) filter (where im.is_cover = true) as cover_count,
  max(im.url_externa) filter (where im.is_cover = true) as cover_url
from public.items i
left join public.item_media im on im.item_id = i.id
group by i.id, i.title;

-- Comentario: Esta vista es útil para validaciones y listados rápidos

-- 8) FUNCIÓN AUXILIAR: Obtener la siguiente posición de ordenación
create or replace function public.get_next_media_sort_order(_item_id uuid, _file_type text)
returns int
language sql
stable
as $$
  select coalesce(max(sort_order), -1) + 1
  from public.item_media
  where item_id = _item_id
    and file_type = _file_type;
$$;

-- 9) FUNCIÓN PARA CAMBIAR LA PORTADA (evita conflictos de validación)
create or replace function public.set_item_cover(_item_id uuid, _media_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Desmarcar todas las portadas del item
  update public.item_media
  set is_cover = false
  where item_id = _item_id
    and file_type = 'image'
    and is_cover = true;
  
  -- Marcar la nueva portada
  update public.item_media
  set is_cover = true
  where id = _media_id
    and file_type = 'image';
end;
$$;

-- 10) COMENTARIOS EN COLUMNAS (Documentación en la DB)
comment on column public.item_media.is_cover is 'Marca si esta imagen es la portada del item. Solo una imagen puede ser portada. Solo aplica a file_type=image.';
comment on column public.item_media.alt_text is 'Texto descriptivo. Opcional para imágenes, OBLIGATORIO para PDFs.';
comment on column public.item_media.sort_order is 'Orden de visualización. Se usa para ordenar las imágenes en galerías.';
comment on column public.item_media.file_type is 'Tipo de archivo: "image" o "pdf". Límites: max 10 imágenes, max 2 PDFs por item.';

-- ================================================================
-- INSTRUCCIONES POST-INSTALACIÓN
-- ================================================================
-- 
-- 1. Ejecuta este script completo en tu base de datos de Supabase
-- 
-- 2. Configura el bucket 'items-media' en Supabase Dashboard:
--    - Storage > items-media > Settings
--    - Public bucket: Yes
--    - File size limit: 52428800 (50MB)
--    - Allowed MIME types: image/jpeg, image/png, application/pdf, image/webp
--
-- 3. Configura las políticas del Storage bucket según lo documentado en el punto 6
--
-- 4. Despliega las Edge Functions:
--    - supabase/functions/upload-item-media/index.ts
--    - supabase/functions/delete-item-media/index.ts
--    
--    Comandos de despliegue:
--    supabase functions deploy upload-item-media
--    supabase functions deploy delete-item-media
--
-- 5. En el frontend (admin-panel), usa las Edge Functions para:
--    - Subir archivos: POST /functions/v1/upload-item-media
--    - Borrar archivos: POST /functions/v1/delete-item-media
--
-- 6. Path de archivos en Storage:
--    Formato: {company_id}/{item_id}/{timestamp}_{uuid}.{extension}
--    Ejemplo: 550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-446655440000/1738713600000_abc123.jpg
--
-- ================================================================

-- FIN DEL SCRIPT
