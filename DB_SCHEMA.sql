-- Tabla de perfiles de usuario (extiende auth.users)

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor', -- admin | editor | viewer
  created_at timestamptz not null default now(),
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

create trigger trg_user_profiles_updated
before update on public.user_profiles
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