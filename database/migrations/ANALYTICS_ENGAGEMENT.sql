-- Analítica — scroll, tiempo en página, 404 y conversiones reservadas
--
-- QUÉ AÑADE
--   scroll_depth  hasta dónde se baja cada página (25 / 50 / 75 / 100 %)
--   engagement    segundos reales en la página, con la pestaña visible
--   not_found     páginas que no existen y desde dónde se llegó a ellas
--   (y, sin cambios de esquema) las claves de clic reservadas phone_click,
--   email_click y form_submit, que valen sin darlas de alta en el panel.
--
-- ORDEN DE EJECUCIÓN (importa):
--   1) ANALYTICS_PRIVACY_UPGRADE.sql   (si no lo has ejecutado ya)
--   2) este fichero
--   3) schema/ANALYTICS_AGGREGATION.sql, VOLVIENDO a ejecutarlo: la función
--      de agregación nueva rellena las columnas que crea este fichero. Si la
--      ejecutas antes, falla porque las columnas no existen.
--
-- No borra ni cambia ningún dato existente.
-- Idempotente. Pegar y ejecutar en el SQL Editor de Supabase.

-- ============================================================
-- 1) Nuevos tipos de evento
-- ============================================================
-- El nombre del check lo puso Postgres al crear la tabla y puede variar, así
-- que se busca por lo que comprueba en vez de borrarlo por nombre.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.analytics_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%event_type%'
  loop
    execute format('alter table public.analytics_events drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.analytics_events
  add constraint analytics_events_event_type_check
  check (event_type in ('page_view', 'cta_click', 'scroll_depth', 'engagement', 'not_found'));

-- ============================================================
-- 2) Valor numérico del evento
-- ============================================================
alter table public.analytics_events
  add column if not exists value integer;

comment on column public.analytics_events.value is
  'scroll_depth: 25|50|75|100 (porcentaje). engagement: segundos en la página. Resto: null.';

-- Coherencia: cada tipo solo lleva el valor que le corresponde. Así, aunque
-- alguien consiguiera escribir con la service role key de una web, no podría
-- guardar valores que rompan las medias.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_events_value_check') then
    alter table public.analytics_events add constraint analytics_events_value_check check (
      (event_type = 'scroll_depth' and value in (25, 50, 75, 100))
      or (event_type = 'engagement' and value between 1 and 7200)
      or (event_type in ('page_view', 'cta_click', 'not_found') and value is null)
    );
  end if;
end $$;

-- ============================================================
-- 3) Nuevas columnas en el resumen diario
-- ============================================================
alter table public.analytics_daily
  add column if not exists by_scroll     jsonb not null default '{}',
  add column if not exists by_engagement jsonb not null default '{}',
  add column if not exists by_not_found  jsonb not null default '{}';

comment on column public.analytics_daily.by_scroll is
  'Por página: cuántas visitas llegaron a cada umbral. { "/servicios": { "25": 40, "50": 22, "75": 9, "100": 4 } }';
comment on column public.analytics_daily.by_engagement is
  'Visitas por tramo de tiempo en página: lt10, 10_30, 30_60, 60_180, gt180 (segundos).';
comment on column public.analytics_daily.by_not_found is
  'Páginas inexistentes y cuántas veces se pidieron. { "/viejo": 12 }';

-- Para el panel: las consultas por empresa y tipo de evento
create index if not exists analytics_events_company_type_idx
  on public.analytics_events (company_id, event_type, created_at desc);

-- ============================================================
-- Comprobaciones
-- ============================================================
-- Los tipos permitidos ahora (debe listar los cinco):
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'analytics_events_event_type_check';
--
-- Que el check de valores rechaza basura (debe dar error):
-- insert into public.analytics_events (company_id, event_type, value, visitor)
-- select id, 'scroll_depth', 33, 'prueba' from public.companies limit 1;
--
-- Cuando ya lleguen datos:
-- select event_type, count(*), round(avg(value)) as media
--   from public.analytics_events
--  where created_at > now() - interval '7 days'
--  group by 1 order by 2 desc;
