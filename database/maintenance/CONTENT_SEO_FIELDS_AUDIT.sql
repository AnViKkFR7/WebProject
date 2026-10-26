-- Read-only preflight for the public blog routes after CONTENT_SEO_FIELDS.sql.
-- Finds published posts without routable slugs and any case-insensitive
-- duplicate slug that would make a company route ambiguous.
with post_slug_counts as (
  select
    company_id,
    id,
    title,
    slug,
    status,
    created_at,
    updated_at,
    count(*) over (partition by company_id, lower(slug)) as duplicate_count
  from public.blog_posts
  where slug is not null
)
select
  'published_slug_missing'::text as issue,
  company_id,
  id as post_id,
  title,
  slug,
  status,
  created_at,
  updated_at
from public.blog_posts
where status = 'published'
  and (slug is null or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
union all
select
  'duplicate_slug'::text as issue,
  company_id,
  id as post_id,
  title,
  slug,
  status,
  created_at,
  updated_at
from post_slug_counts
where duplicate_count > 1
order by company_id, issue, title, post_id;
