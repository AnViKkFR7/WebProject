-- Auditoría de seguridad 21/11/2026: endurecimiento de la lectura de item_media.
--
-- schema/ITEM_MEDIA_STORAGE.sql creó "item_media_public_select" con using(true) para
-- anon y authenticated. Las políticas permisivas se suman (OR), así que esta anulaba
-- las dos que sí acotan la lectura:
--   - item_media_public: cualquiera ve los medios de elementos PUBLICADOS (webs).
--   - item_media_select_tenant: miembros de la empresa y admin de plataforma ven todo.
--
-- Hoy no se explota: la política restrictiva item_media_module_gate consulta items, y esa
-- consulta respeta la RLS de items, de modo que un borrador ajeno queda oculto igualmente.
-- Pero la protección dependía de un efecto colateral del filtro de módulos; si ese filtro
-- pasara a una función security definer, los medios de borradores de cualquier empresa
-- quedarían visibles con la clave pública. Se elimina la política abierta para que la
-- regla sea explícita. Las webs leen solo medios publicados y el panel lee como miembro:
-- nada visible cambia. Idempotente.
begin;

drop policy if exists "item_media_public_select" on public.item_media;

commit;
