-- Auditoría de solo lectura para preparar el SEO de items de un sitio.
-- Sustituye ambos valores por el tenant y item_type aprobados antes de ejecutar.
-- No devuelve ni actualiza items de otras empresas/tipos.
with target as (
  select 'REEMPLAZAR_UUID_EMPRESA'::uuid as company_id,
         'REEMPLAZAR_ITEM_TYPE'::text as item_type
), published as (
  select i.id, i.company_id, i.item_type, i.title, i.summary, i.status,
         i.slug, i.seo_title, i.seo_description, i.seo_og_image_url,
         i.updated_at
  from public.items i
  join target t on t.company_id = i.company_id and t.item_type = i.item_type
  where i.status = 'published'
), findings as (
  select p.*,
    array_remove(array[
      case when p.slug is null or btrim(p.slug) = '' then 'missing_slug' end,
      case when p.slug is not null and (p.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p.slug)>120) then 'invalid_slug' end,
      case when p.seo_title is null or btrim(p.seo_title) = '' then 'missing_seo_title' end,
      case when p.seo_title is not null and char_length(p.seo_title)>70 then 'seo_title_over_70' end,
      case when p.seo_description is null or btrim(p.seo_description) = '' then 'missing_seo_description' end,
      case when p.seo_description is not null and char_length(p.seo_description)>160 then 'seo_description_over_160' end,
      case when p.seo_og_image_url is not null and p.seo_og_image_url !~* '^https://[^[:space:]]+$' then 'invalid_og_image_url' end,
      case when p.seo_og_image_url is not null and char_length(p.seo_og_image_url)>2048 then 'og_image_url_over_2048' end
    ], null) as issues
  from published p
)
select f.id, f.company_id, f.item_type, f.title, f.summary,
       f.slug, f.seo_title, f.seo_description, f.seo_og_image_url,
       f.updated_at, f.issues,
       (select count(*) from public.items other
        where other.company_id=f.company_id
          and other.id<>f.id
          and other.slug is not null
          and lower(other.slug)=lower(f.slug)) as same_company_slug_collisions
from findings f
order by f.title, f.id;
