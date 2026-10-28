-- Plantilla por sitio para aplicar metadatos SEO revisados a items publicados.
-- Sustituye la fila de ejemplo. No ejecutes sin IDs/valores verificados.
-- Cada lote debe contener exclusivamente un company_id y un item_type.
-- Ejecutar en el proyecto Supabase correspondiente y revisar el SELECT antes de COMMIT.

begin;

create temporary table seo_item_proposals (
  id uuid primary key,
  company_id uuid not null,
  item_type text not null,
  slug text not null,
  seo_title text not null,
  seo_description text not null,
  seo_og_image_url text
) on commit drop;

-- EJEMPLO: reemplaza o duplica esta fila con el lote aprobado.
insert into seo_item_proposals
  (id, company_id, item_type, slug, seo_title, seo_description, seo_og_image_url)
values
  ('REEMPLAZAR_UUID_ITEM', 'REEMPLAZAR_UUID_EMPRESA', 'REEMPLAZAR_ITEM_TYPE',
   'slug-revisado', 'Título SEO revisado', 'Descripción SEO revisada', null);

do $$
declare
  v_company_count integer;
  v_type_count integer;
  v_invalid_count integer;
  v_target_count integer;
  v_collision_count integer;
begin
  select count(distinct company_id), count(distinct item_type)
    into v_company_count, v_type_count
  from seo_item_proposals;

  if v_company_count <> 1 or v_type_count <> 1 then
    raise exception 'El lote debe pertenecer a una sola empresa y un solo item_type';
  end if;

  select count(*) into v_invalid_count
  from seo_item_proposals p
  where p.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(p.slug) > 120
     or char_length(p.seo_title) > 70
     or char_length(p.seo_description) > 160
     or (p.seo_og_image_url is not null and (
          p.seo_og_image_url !~ '^https://'
          or char_length(p.seo_og_image_url) > 2048
        ));
  if v_invalid_count > 0 then
    raise exception 'Hay campos SEO que incumplen formato o límites';
  end if;

  if exists (
    select 1 from seo_item_proposals p
    group by p.company_id, lower(p.slug)
    having count(*) > 1
  ) then
    raise exception 'Hay slugs duplicados dentro del lote';
  end if;

  select count(*) into v_target_count
  from seo_item_proposals p
  join public.items i on i.id = p.id
    and i.company_id = p.company_id
    and i.item_type = p.item_type
    and i.status = 'published';
  if v_target_count <> (select count(*) from seo_item_proposals) then
    raise exception 'Algún item no existe, no coincide con empresa/tipo o no está publicado';
  end if;

  -- El índice real es único por empresa para todos los item_type.
  -- Se rechaza cualquier slug ocupado por otro item, aunque también esté en el lote;
  -- esto evita colisiones transitorias y requiere slugs nuevos para los cambios.
  select count(*) into v_collision_count
  from seo_item_proposals p
  join public.items other on other.company_id = p.company_id
    and lower(other.slug) = lower(p.slug)
    and other.id <> p.id;
  if v_collision_count > 0 then
    raise exception 'Un slug propuesto ya pertenece a otro item de la empresa';
  end if;
end $$;

update public.items i
set slug = p.slug,
    seo_title = p.seo_title,
    seo_description = p.seo_description,
    seo_og_image_url = p.seo_og_image_url,
    updated_at = now()
from seo_item_proposals p
where i.id = p.id
  and i.company_id = p.company_id
  and i.item_type = p.item_type
  and i.status = 'published';

-- Revisa que el lote resultante coincide con la propuesta antes de confirmar.
select i.id, i.company_id, i.item_type, i.status,
       i.slug, i.seo_title, i.seo_description, i.seo_og_image_url
from public.items i
join seo_item_proposals p on p.id = i.id
where i.company_id = p.company_id
  and i.item_type = p.item_type
order by i.slug;

-- Si el resultado es correcto, ejecuta COMMIT; si no, ejecuta ROLLBACK.
-- COMMIT;
-- ROLLBACK;
