-- Tabla de empresas
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  description text,
  contact_email text not null,
  contact_phone text not null,
  website_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Relación usuario ↔ empresa (multi-tenant)
-- Incluye datos de perfil del usuario específicos por empresa
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor', -- admin | editor | viewer
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Índices útiles
create index on public.company_members (user_id);
create index on public.company_members (company_id);

-- Timestamps auto-actualizables (opcional)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_company_members_updated
before update on public.company_members
for each row execute function public.set_updated_at();

create trigger trg_companies_updated
before update on public.companies
for each row execute function public.set_updated_at();

-- 1) ELEMENTOS GENÉRICOS
create table public.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'draft', -- draft | published | archived
  item_type text not null, -- ejemplo: "property", "dish"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) DEFINICIONES DE ATRIBUTOS (qué existe y su tipo)
create table public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_type text not null, -- a qué tipo aplica
  key text not null, -- ejemplo: "price", "rooms", "allergens"
  label text not null, -- "Precio", "Habitaciones"
  data_type text not null, -- text | number | boolean | date | json | text_array | number_array
  is_filterable boolean not null default false,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, item_type, key)
);

-- 3) VALORES DE ATRIBUTOS (datos reales)
create table public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  attribute_id uuid not null references public.attribute_definitions(id) on delete cascade,

  -- columnas tipadas (solo una se usa según data_type)
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  value_json jsonb,
  value_text_array text[],
  value_number_array numeric[],

  created_at timestamptz not null default now(),
  unique (item_id, attribute_id)
);

-- 4) MEDIA POR ELEMENTO (imágenes y PDFs)
create table public.item_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  file_type text not null, -- image | pdf | other
  url_externa text not null,       -- URL en Supabase Storage o externo
  title text,
  alt_text text,
  sort_order int not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- 5) BLOG (simple)
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  heading text,
  intro text,
  body text not null,
  status text not null default 'draft', -- draft | published | archived
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blog_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  file_type text not null, -- image | pdf | other
  url_externa text not null,
  title text,
  alt_text text,
  sort_order int not null default 0,
  metadata jsonb,
  is_cover_image boolean not null,
  created_at timestamptz not null default now()
);

-- 0) Helper: admin global por claim en JWT
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role') = 'admin', false);
$$;

-- 1) Helper: membership/roles (bypass RLS)
create or replace function public.has_company_role(_company_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = _company_id
      and cm.user_id = auth.uid()
      and cm.role = any(_roles)
  );
$$;

create or replace function public.is_company_member(_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = _company_id
      and cm.user_id = auth.uid()
  );
$$;

-- 2) Campos audit
alter table public.companies
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

alter table public.company_members
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

alter table public.items
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

alter table public.attribute_definitions
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

alter table public.attribute_values
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

alter table public.item_media
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

alter table public.blog_posts
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

alter table public.blog_media
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

-- 3) Trigger audit genérico
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.last_edited_by is null then
      new.last_edited_by := auth.uid();
    end if;
  else
    new.last_edited_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_companies_audit on public.companies;
create trigger trg_companies_audit
before insert or update on public.companies
for each row execute function public.set_audit_fields();

drop trigger if exists trg_company_members_audit on public.company_members;
create trigger trg_company_members_audit
before insert or update on public.company_members
for each row execute function public.set_audit_fields();

drop trigger if exists trg_items_audit on public.items;
create trigger trg_items_audit
before insert or update on public.items
for each row execute function public.set_audit_fields();

drop trigger if exists trg_attribute_definitions_audit on public.attribute_definitions;
create trigger trg_attribute_definitions_audit
before insert or update on public.attribute_definitions
for each row execute function public.set_audit_fields();

drop trigger if exists trg_attribute_values_audit on public.attribute_values;
create trigger trg_attribute_values_audit
before insert or update on public.attribute_values
for each row execute function public.set_audit_fields();

drop trigger if exists trg_item_media_audit on public.item_media;
create trigger trg_item_media_audit
before insert or update on public.item_media
for each row execute function public.set_audit_fields();

drop trigger if exists trg_blog_posts_audit on public.blog_posts;
create trigger trg_blog_posts_audit
before insert or update on public.blog_posts
for each row execute function public.set_audit_fields();

drop trigger if exists trg_blog_media_audit on public.blog_media;
create trigger trg_blog_media_audit
before insert or update on public.blog_media
for each row execute function public.set_audit_fields();

-- 5) updated_at para items y blog_posts
drop trigger if exists trg_items_updated on public.items;
create trigger trg_items_updated
before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists trg_blog_posts_updated on public.blog_posts;
create trigger trg_blog_posts_updated
before update on public.blog_posts
for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.items enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.attribute_values enable row level security;
alter table public.item_media enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_media enable row level security;


-- 7) Policies: companies
drop policy if exists "companies_select" on public.companies;
create policy "companies_select"
on public.companies
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(id)
);

drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert"
on public.companies
for insert
to authenticated
with check (public.is_platform_admin());

drop policy if exists "companies_update" on public.companies;
create policy "companies_update"
on public.companies
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(id, array['editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(id, array['editor'])
);

drop policy if exists "companies_delete" on public.companies;
create policy "companies_delete"
on public.companies
for delete
to authenticated
using (public.is_platform_admin());

-- 8) Policies: company_members
-- Los datos de perfil (full_name, phone, avatar_url) viven aquí
drop policy if exists "company_members_select" on public.company_members;
create policy "company_members_select"
on public.company_members
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

drop policy if exists "company_members_insert_admin" on public.company_members;
create policy "company_members_insert_admin"
on public.company_members
for insert
to authenticated
with check (public.is_platform_admin());

drop policy if exists "company_members_insert_editor_viewer" on public.company_members;
create policy "company_members_insert_editor_viewer"
on public.company_members
for insert
to authenticated
with check (
  public.has_company_role(company_id, array['editor'])
  and role = 'viewer'
);

drop policy if exists "company_members_update" on public.company_members;
create policy "company_members_update"
on public.company_members
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "company_members_delete_admin" on public.company_members;
create policy "company_members_delete_admin"
on public.company_members
for delete
to authenticated
using (public.is_platform_admin());

drop policy if exists "company_members_delete_editor_viewer" on public.company_members;
create policy "company_members_delete_editor_viewer"
on public.company_members
for delete
to authenticated
using (
  public.has_company_role(company_id, array['editor'])
  and role = 'viewer'
);

-- 9) Policies: items (public + tenant)
drop policy if exists "items_public_published" on public.items;
create policy "items_public_published"
on public.items
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "items_select_tenant" on public.items;
create policy "items_select_tenant"
on public.items
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

drop policy if exists "items_write_tenant" on public.items;
create policy "items_write_tenant"
on public.items
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['editor'])
);

-- 10) Policies: attribute_definitions (public derivado + tenant)
drop policy if exists "attribute_definitions_public" on public.attribute_definitions;
create policy "attribute_definitions_public"
on public.attribute_definitions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.items i
    where i.company_id = attribute_definitions.company_id
      and i.item_type = attribute_definitions.item_type
      and i.status = 'published'
  )
);

drop policy if exists "attribute_definitions_select_tenant" on public.attribute_definitions;
create policy "attribute_definitions_select_tenant"
on public.attribute_definitions
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

drop policy if exists "attribute_definitions_write_tenant" on public.attribute_definitions;
create policy "attribute_definitions_write_tenant"
on public.attribute_definitions
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['editor'])
);

-- 11) Policies: attribute_values (public derivado + tenant)
drop policy if exists "attribute_values_public" on public.attribute_values;
create policy "attribute_values_public"
on public.attribute_values
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.items i
    where i.id = attribute_values.item_id
      and i.status = 'published'
  )
);

drop policy if exists "attribute_values_select_tenant" on public.attribute_values;
create policy "attribute_values_select_tenant"
on public.attribute_values
for select
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = attribute_values.item_id
      and public.is_company_member(i.company_id)
  )
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
      and public.has_company_role(i.company_id, array['editor'])
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = attribute_values.item_id
      and public.has_company_role(i.company_id, array['editor'])
  )
);

-- 12) Policies: item_media (public derivado + tenant)
drop policy if exists "item_media_public" on public.item_media;
create policy "item_media_public"
on public.item_media
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and i.status = 'published'
  )
);

drop policy if exists "item_media_select_tenant" on public.item_media;
create policy "item_media_select_tenant"
on public.item_media
for select
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.items i
    where i.id = item_media.item_id
      and public.is_company_member(i.company_id)
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

-- 13) Policies: blog_posts (public + tenant)
drop policy if exists "blog_posts_public" on public.blog_posts;
create policy "blog_posts_public"
on public.blog_posts
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "blog_posts_select_tenant" on public.blog_posts;
create policy "blog_posts_select_tenant"
on public.blog_posts
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

drop policy if exists "blog_posts_write_tenant" on public.blog_posts;
create policy "blog_posts_write_tenant"
on public.blog_posts
for all
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['editor'])
);

-- 14) Policies: blog_media (public derivado + tenant)
drop policy if exists "blog_media_public" on public.blog_media;
create policy "blog_media_public"
on public.blog_media
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.blog_posts p
    where p.id = blog_media.post_id
      and p.status = 'published'
  )
);

drop policy if exists "blog_media_select_tenant" on public.blog_media;
create policy "blog_media_select_tenant"
on public.blog_media
for select
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.blog_posts p
    where p.id = blog_media.post_id
      and public.is_company_member(p.company_id)
  )
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
      and public.has_company_role(p.company_id, array['editor'])
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.blog_posts p
    where p.id = blog_media.post_id
      and public.has_company_role(p.company_id, array['editor'])
  )
);
-- FIN DEL ESQUEMA