-- Campos editoriales para posts e items. Aplicar después de DB_SCHEMA.sql.
-- No cambia el estado ni el contenido publicado existente.
begin;

alter table public.items
  add column if not exists slug text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_og_image_url text;

alter table public.blog_posts
  add column if not exists slug text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_og_image_url text,
  add column if not exists published_at timestamptz;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.items'::regclass and conname='items_seo_fields_check') then
    alter table public.items add constraint items_seo_fields_check check (
      (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') and
      (seo_title is null or char_length(seo_title)<=70) and
      (seo_description is null or char_length(seo_description)<=160) and
      (seo_og_image_url is null or (char_length(seo_og_image_url)<=2048 and seo_og_image_url ~* '^https://[^[:space:]]+$'))
    );
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.blog_posts'::regclass and conname='blog_posts_seo_fields_check') then
    alter table public.blog_posts add constraint blog_posts_seo_fields_check check (
      (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') and
      (seo_title is null or char_length(seo_title)<=70) and
      (seo_description is null or char_length(seo_description)<=160) and
      (seo_og_image_url is null or (char_length(seo_og_image_url)<=2048 and seo_og_image_url ~* '^https://[^[:space:]]+$'))
    );
  end if;
end $$;

create unique index if not exists items_company_slug_unique
  on public.items(company_id,lower(slug)) where slug is not null;
create unique index if not exists blog_posts_company_slug_unique
  on public.blog_posts(company_id,lower(slug)) where slug is not null;

update public.blog_posts
set published_at=created_at
where status='published' and published_at is null;

create or replace function public.set_blog_published_at()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='published' and new.published_at is null then
    new.published_at:=pg_catalog.now();
  end if;
  return new;
end $$;

drop trigger if exists blog_posts_published_at on public.blog_posts;
create trigger blog_posts_published_at
before insert or update on public.blog_posts
for each row execute function public.set_blog_published_at();

revoke all on function public.set_blog_published_at() from public,anon,authenticated;
commit;
