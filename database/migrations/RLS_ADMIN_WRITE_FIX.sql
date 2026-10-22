-- RLS — el rol `admin` de empresa también puede escribir
--
-- Todas las políticas de escritura comprobaban solo `array['editor']`, así que
-- un miembro con rol `admin` en su empresa veía los botones del panel pero la
-- base de datos le rechazaba los cambios (atributos, items, media, blog,
-- planning y analítica). Esto las recrea con `array['admin', 'editor']`.
--
-- Los ficheros de esquema del repo ya están actualizados: esto es solo para
-- aplicarlo a una base de datos que ya existe, sin volver a ejecutarlos.
--
-- Idempotente (cada política se borra y se vuelve a crear).
-- Pegar y ejecutar en el SQL Editor de Supabase.
--
-- NOTA: cambiar el ROL de un miembro (company_members UPDATE) sigue estando
-- reservado al admin de plataforma, a propósito.

-- ============================================================
-- DB_SCHEMA.sql
-- ============================================================
drop policy if exists "companies_update" on public.companies;
create policy "companies_update"
on public.companies
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(id, array['admin', 'editor'])
);

drop policy if exists "company_members_insert_editor_viewer" on public.company_members;
create policy "company_members_insert_editor_viewer"
on public.company_members
for insert
to authenticated
with check (
  public.has_company_role(company_id, array['admin', 'editor'])
  and role = 'viewer'
);

drop policy if exists "company_members_delete_editor_viewer" on public.company_members;
create policy "company_members_delete_editor_viewer"
on public.company_members
for delete
to authenticated
using (
  public.has_company_role(company_id, array['admin', 'editor'])
  and role = 'viewer'
);

drop policy if exists "items_write_tenant" on public.items;
create policy "items_write_tenant"
on public.items
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

drop policy if exists "attribute_definitions_write_tenant" on public.attribute_definitions;
create policy "attribute_definitions_write_tenant"
on public.attribute_definitions
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

drop policy if exists "attribute_values_write_tenant" on public.attribute_values;
create policy "attribute_values_write_tenant"
on public.attribute_values
for all
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = attribute_values.item_id
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = attribute_values.item_id
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
);

drop policy if exists "item_media_write_tenant" on public.item_media;
create policy "item_media_write_tenant"
on public.item_media
for all
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
);

drop policy if exists "blog_posts_write_tenant" on public.blog_posts;
create policy "blog_posts_write_tenant"
on public.blog_posts
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

drop policy if exists "blog_media_write_tenant" on public.blog_media;
create policy "blog_media_write_tenant"
on public.blog_media
for all
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.blog_posts p
    where p.id = blog_media.post_id
      and public.has_company_role(p.company_id, array['admin', 'editor'])
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.blog_posts p
    where p.id = blog_media.post_id
      and public.has_company_role(p.company_id, array['admin', 'editor'])
  )
);

-- ============================================================
-- PLANNING_SCHEMA.sql
-- ============================================================
drop policy if exists "client_company_write_tenant" on public.client_company;
create policy "client_company_write_tenant"
on public.client_company
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

drop policy if exists "planning_task_write_tenant" on public.planning_task;
create policy "planning_task_write_tenant"
on public.planning_task
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

drop policy if exists "billing_write_tenant" on public.billing;
create policy "billing_write_tenant"
on public.billing
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

-- ============================================================
-- ANALYTICS_SCHEMA.sql
-- ============================================================
drop policy if exists "analytics_event_definitions_write_tenant" on public.analytics_event_definitions;
create policy "analytics_event_definitions_write_tenant"
on public.analytics_event_definitions
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

-- ============================================================
-- ITEM_MEDIA_STORAGE.sql
-- ============================================================
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
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
);

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
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
);

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
      and public.has_company_role(i.company_id, array['admin', 'editor'])
  )
);

-- ============================================================
-- ANALYTICS_AGGREGATION.sql — botón "Actualizar ahora"
-- ============================================================
create or replace function public.trigger_company_analytics_aggregation(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_platform_admin()
    or public.has_company_role(target_company_id, array['admin', 'editor'])
  ) then
    raise exception 'not authorized';
  end if;

  perform public.aggregate_analytics_rollup(current_date, target_company_id);
end;
$$;
