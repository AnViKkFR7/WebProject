-- Analítica propia por empresa — Fase 1 (esquema)
-- Ver admin-panel/new_feature.md y admin-panel/roadmap.md
--
-- Requiere que ya exista el esquema base (DB_SCHEMA.sql): companies,
-- is_platform_admin(), has_company_role(), is_company_member(),
-- set_audit_fields(), set_updated_at().
--
-- Pegar y ejecutar en el SQL Editor de Supabase.

-- ============================================================
-- 0) DEFINICIONES DE EVENTO
-- Lo que la empresa da de alta desde el admin. 'page_view' NUNCA se guarda
-- aquí: es implícito, se dispara solo en cada cambio de ruta y siempre está
-- permitido. Esta tabla es solo para los eventos de clic/CTA que cada
-- empresa quiere medir (cuantos quiera).
-- ============================================================
create table if not exists public.analytics_event_definitions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  key            text not null,       -- identificador estable, ej. "whatsapp_click"
                                       -- usado en data-track-event="key"
  label          text not null,       -- nombre legible en el dashboard: "Clic en WhatsApp"
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  last_edited_by uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, key)
);

alter table public.analytics_event_definitions enable row level security;

drop policy if exists "analytics_event_definitions_select_tenant" on public.analytics_event_definitions;
create policy "analytics_event_definitions_select_tenant"
on public.analytics_event_definitions
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

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

drop trigger if exists trg_analytics_event_definitions_audit on public.analytics_event_definitions;
create trigger trg_analytics_event_definitions_audit
before insert or update on public.analytics_event_definitions
for each row execute function public.set_audit_fields();

drop trigger if exists trg_analytics_event_definitions_updated on public.analytics_event_definitions;
create trigger trg_analytics_event_definitions_updated
before update on public.analytics_event_definitions
for each row execute function public.set_updated_at();

-- ============================================================
-- 1) EVENTOS EN CRUDO
-- Se purgan a los 35 días (ver ANALYTICS_AGGREGATION.sql) — el dashboard lee
-- de analytics_daily, no de aquí directamente, salvo para depuración puntual.
-- Solo el service role (endpoint de ingesta, fuera de RLS) inserta aquí.
-- ============================================================
create table if not exists public.analytics_events (
  id            bigint generated always as identity primary key,
  company_id    uuid not null references public.companies(id) on delete cascade,
  event_type    text not null check (event_type in ('page_view', 'cta_click')),
  event_key     text,                 -- null para page_view; para cta_click,
                                       -- debe existir en analytics_event_definitions
  path          text,                 -- ruta de la página (page_view) o
                                       -- dónde ocurrió el clic (cta_click)
  session_id    text not null,        -- NO es un ID persistente de usuario
  device        text check (device in ('mobile', 'desktop', 'tablet')),
  country       text,                 -- ISO 3166-1 alpha-2, ej. "ES"
  region        text,                 -- ej. "Catalonia" (lo que dé Vercel)
  city          text,
  created_at    timestamptz not null default now()
);

create index if not exists analytics_events_company_day_idx
  on public.analytics_events (company_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_select_tenant" on public.analytics_events;
create policy "analytics_events_select_tenant"
on public.analytics_events
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);
-- Sin política de insert/update para "authenticated"/"anon" a propósito:
-- solo el service role (que salta RLS) escribe aquí.

-- ============================================================
-- 2) ROLLUP DIARIO
-- Lo que realmente consulta el dashboard. Se conserva a largo plazo aunque
-- se purguen los eventos crudos.
-- ============================================================
create table if not exists public.analytics_daily (
  company_id      uuid not null references public.companies(id) on delete cascade,
  day             date not null,
  unique_visitors integer not null default 0,
  page_views      integer not null default 0,
  by_path         jsonb not null default '{}',   -- { "/servicios": 12, "/": 84, ... }
  by_device       jsonb not null default '{}',   -- { "mobile": 60, "desktop": 40 }
  by_country      jsonb not null default '{}',   -- { "ES": 90, "FR": 4, ... }
  by_event        jsonb not null default '{}',   -- { "whatsapp_click": 12, "form_submit": 4, ... }
  primary key (company_id, day)
);

alter table public.analytics_daily enable row level security;

drop policy if exists "analytics_daily_select_tenant" on public.analytics_daily;
create policy "analytics_daily_select_tenant"
on public.analytics_daily
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);
-- Igual que analytics_events: sin política de insert/update para
-- authenticated/anon, solo escribe el job de agregación (security definer
-- o service role).

-- ============================================================
-- 3) Seed opcional: eventos por defecto para empresas ya existentes
-- (para empresas nuevas, sembrar esto dentro de la función Edge
-- crear-empresa — ver admin-panel/roadmap.md Fase 1).
-- Comentado a propósito: descomentar y ejecutar una sola vez si se quiere
-- que las empresas que YA existen arranquen con form_open/form_submit
-- dados de alta sin tener que crearlos a mano desde el admin.
-- ============================================================
-- insert into public.analytics_event_definitions (company_id, key, label)
-- select id, 'form_open', 'Apertura de formulario de contacto' from public.companies
-- on conflict (company_id, key) do nothing;
--
-- insert into public.analytics_event_definitions (company_id, key, label)
-- select id, 'form_submit', 'Envío de formulario de contacto' from public.companies
-- on conflict (company_id, key) do nothing;

-- FIN DEL ESQUEMA DE ANALÍTICA
