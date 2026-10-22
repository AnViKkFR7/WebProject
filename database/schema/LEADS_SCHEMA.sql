-- Bandeja de solicitudes (leads)
--
-- Lo que llega por el formulario de contacto de cada web de empresa, con
-- estado (nueva / contactada / cerrada) para no perder a nadie.
--
-- Cómo entra el dato: la web NO escribe directamente en Supabase. Llama a su
-- propia función de servidor (/api/lead), que usa la service role key y se
-- salta RLS. Igual que la analítica. Por eso aquí NO hay política de insert
-- para anon ni para authenticated: si la hubiera, cualquiera podría llenar la
-- bandeja de basura con la clave pública.
--
-- Usa los helpers de DB_SCHEMA.sql: is_platform_admin(), is_company_member(),
-- has_company_role().
--
-- Idempotente. Pegar y ejecutar en el SQL Editor de Supabase.

create table if not exists public.lead (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  name text not null,
  email text,
  phone text,
  message text,

  -- De dónde viene: página y campaña, para saber qué página trae clientes
  source_path text,
  source_campaign text,

  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notes text,                                    -- notas internas, no las ve el visitante

  created_at timestamptz not null default now(),
  updated_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

comment on table public.lead is 'Solicitudes del formulario de contacto de las webs de empresa.';
comment on column public.lead.notes is 'Notas internas del equipo. Nunca se muestran en la web.';

create index if not exists lead_company_status_idx
  on public.lead (company_id, status, created_at desc);

create index if not exists lead_company_created_idx
  on public.lead (company_id, created_at desc);

-- updated_at al tocar la fila
create or replace function public.touch_lead_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lead_updated_at on public.lead;
create trigger trg_lead_updated_at
before update on public.lead
for each row execute function public.touch_lead_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.lead enable row level security;

-- Leer: cualquier miembro de la empresa (también un viewer, para que pueda
-- consultar sin cambiar nada)
drop policy if exists "lead_select_tenant" on public.lead;
create policy "lead_select_tenant"
on public.lead
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_company_member(company_id)
);

-- Cambiar el estado o las notas: quien puede editar en la empresa
drop policy if exists "lead_update_tenant" on public.lead;
create policy "lead_update_tenant"
on public.lead
for update
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
)
with check (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

drop policy if exists "lead_delete_tenant" on public.lead;
create policy "lead_delete_tenant"
on public.lead
for delete
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['admin', 'editor'])
);

-- A propósito NO hay política de INSERT: solo entra por la función de
-- servidor de cada web, que usa la service role key.

-- Comprobar:
-- select status, count(*) from public.lead group by status;
