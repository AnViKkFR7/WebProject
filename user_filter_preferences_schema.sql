-- Tabla para guardar las preferencias de filtros de cada usuario
create table public.user_filter_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page text not null, -- 'items', 'blog', etc.
  filter_config jsonb not null, -- { advanced_filters: ['attribute_def_id_1', 'attribute_def_id_2'], other_settings: {} }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, page)
);

-- Índice para búsquedas rápidas por usuario
create index on public.user_filter_preferences (user_id);
create index on public.user_filter_preferences (user_id, page);

-- Trigger para actualizar updated_at
drop trigger if exists trg_user_filter_preferences_updated on public.user_filter_preferences;
create trigger trg_user_filter_preferences_updated
before update on public.user_filter_preferences
for each row execute function public.set_updated_at();

-- RLS: cada usuario solo puede ver y modificar sus propias preferencias
alter table public.user_filter_preferences enable row level security;

drop policy if exists "user_filter_preferences_select" on public.user_filter_preferences;
create policy "user_filter_preferences_select"
on public.user_filter_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_filter_preferences_insert" on public.user_filter_preferences;
create policy "user_filter_preferences_insert"
on public.user_filter_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_filter_preferences_update" on public.user_filter_preferences;
create policy "user_filter_preferences_update"
on public.user_filter_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_filter_preferences_delete" on public.user_filter_preferences;
create policy "user_filter_preferences_delete"
on public.user_filter_preferences
for delete
to authenticated
using (user_id = auth.uid());
