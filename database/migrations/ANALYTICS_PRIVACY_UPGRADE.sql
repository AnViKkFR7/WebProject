-- Analítica — visitantes anónimos, fuentes de tráfico e idioma
--
-- QUÉ CAMBIA Y POR QUÉ
--
-- 1) Los únicos se contaban con session_id, un identificador que generaba el
--    NAVEGADOR. Eso tenía dos problemas: se podía falsear desde fuera, y
--    contaba una persona nueva por cada pestaña. Ahora el visitante es un
--    hash que calcula el SERVIDOR con la sal del día + IP + user-agent.
--    La IP no se guarda en ningún momento.
--
-- 2) La sal del día es aleatoria, la genera la base de datos y se borra a
--    las 48 h. Pasado ese plazo, ni teniendo la IP se puede recalcular de
--    quién era un hash: los datos antiguos quedan anónimos de verdad.
--
-- 3) Se empieza a guardar de dónde viene la visita (referrer y UTM) y en qué
--    idioma navega, que es lo que más echábamos en falta para saber qué
--    campañas traen gente.
--
-- Idempotente. Requiere ANALYTICS_SCHEMA.sql y ANALYTICS_AGGREGATION.sql.
-- Pegar y ejecutar en el SQL Editor de Supabase.

-- ============================================================
-- 1) Columnas nuevas en los eventos
-- ============================================================
alter table public.analytics_events
  add column if not exists visitor      text,
  add column if not exists lang         text,
  add column if not exists referrer     text,
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text;

-- session_id deja de ser obligatorio: los eventos nuevos ya no lo traen.
-- Se conserva la columna para no perder el histórico anterior.
alter table public.analytics_events alter column session_id drop not null;

comment on column public.analytics_events.session_id is
  'EN DESUSO desde ANALYTICS_PRIVACY_UPGRADE.sql. Lo generaba el navegador. Usa visitor.';
comment on column public.analytics_events.visitor is
  'Hash anónimo del día: sal diaria + IP + user-agent. No permite seguir a nadie entre días.';

-- Topes de longitud, para que un cliente manipulado no infle la tabla
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_events_text_limits') then
    alter table public.analytics_events add constraint analytics_events_text_limits check (
      char_length(coalesce(visitor, ''))      <= 64 and
      char_length(coalesce(lang, ''))         <= 12 and
      char_length(coalesce(referrer, ''))     <= 120 and
      char_length(coalesce(utm_source, ''))   <= 100 and
      char_length(coalesce(utm_medium, ''))   <= 100 and
      char_length(coalesce(utm_campaign, '')) <= 100 and
      char_length(coalesce(path, ''))         <= 300
    );
  end if;
end $$;

create index if not exists analytics_events_visitor_idx
  on public.analytics_events (visitor, created_at);

-- ============================================================
-- 2) Sal diaria aleatoria que se destruye
-- ============================================================
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.analytics_salts (
  day  date primary key,
  salt text not null
);

-- Tres capas de protección sobre la misma tabla, a propósito:
--   1. Vive en el esquema `private`, que la API de Supabase no expone.
--   2. Se le quitan los permisos a anon y authenticated.
--   3. RLS activada y SIN políticas: nadie puede leerla ni escribirla.
-- Las funciones de abajo son `security definer`, así que corren como su
-- dueño y sí pueden entrar. Si no activáramos RLS, Supabase avisaría al
-- ejecutar este script, y ese aviso tendría parte de razón: una tabla con
-- secretos no debería depender solo de en qué esquema está.
revoke all on private.analytics_salts from public, anon, authenticated;
alter table private.analytics_salts enable row level security;

-- La pide el endpoint de las webs (service role). Nunca el navegador.
create or replace function public.analytics_salt(p_day date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salt text;
begin
  -- No se regenera la sal de días pasados: si se pudiera, se podría
  -- recalcular quién era cada hash antiguo teniendo la IP.
  if p_day < (now() at time zone 'Europe/Madrid')::date - 1 then
    raise exception 'Sal caducada' using errcode = 'check_violation';
  end if;

  insert into private.analytics_salts (day, salt)
  values (p_day, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (day) do nothing;

  select s.salt into v_salt from private.analytics_salts s where s.day = p_day;
  return v_salt;
end;
$$;

revoke all on function public.analytics_salt(date) from public, anon, authenticated;
grant execute on function public.analytics_salt(date) to service_role;

-- ============================================================
-- 3) Tope por visitante (anti-inundación)
-- ============================================================
-- Si alguien consigue mandar eventos en masa, a partir de 500 en 24 h los
-- suyos se descartan en silencio en vez de falsear las estadísticas.
create or replace function private.analytics_events_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visitor is not null and (
    select count(*) from public.analytics_events e
    where e.visitor = new.visitor and e.created_at > now() - interval '24 hours'
  ) >= 500 then
    return null;   -- descartar sin error
  end if;
  return new;
end;
$$;

drop trigger if exists trg_analytics_events_rate_limit on public.analytics_events;
create trigger trg_analytics_events_rate_limit
before insert on public.analytics_events
for each row execute function private.analytics_events_rate_limit();

-- ============================================================
-- 4) Nuevas dimensiones en el resumen diario
-- ============================================================
alter table public.analytics_daily
  add column if not exists by_source jsonb not null default '{}',
  add column if not exists by_lang   jsonb not null default '{}';

comment on column public.analytics_daily.by_source is
  'De dónde vino la visita: utm_source, si no el dominio del referrer, si no (directo).';

-- ============================================================
-- 5) Limpieza de sales (engánchalo al cron nocturno que ya existe)
-- ============================================================
create or replace function public.analytics_cleanup_salts()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.analytics_salts
  where day < (now() at time zone 'Europe/Madrid')::date - 1;
$$;

revoke all on function public.analytics_cleanup_salts() from public, anon, authenticated;
grant execute on function public.analytics_cleanup_salts() to service_role;

-- Añade esta llamada al job de agregación nocturna que ya tienes
-- (ANALYTICS_AGGREGATION.sql), para que las sales no se acumulen:
--   perform public.analytics_cleanup_salts();

-- ============================================================
-- Comprobaciones
-- ============================================================
-- 1) La función genera la sal del día. En el SQL Editor eres `postgres`, así
--    que esto funciona; que anon no pueda es cosa del revoke de arriba.
-- select public.analytics_salt(current_date);
--
-- 2) La sal existe y es larga (64 caracteres):
-- select day, length(salt) from private.analytics_salts order by day desc;
--
-- 3) RLS activada y sin políticas (debe decir true y 0):
-- select relrowsecurity,
--        (select count(*) from pg_policies
--          where schemaname = 'private' and tablename = 'analytics_salts') as politicas
--   from pg_class where oid = 'private.analytics_salts'::regclass;
--
-- 4) No se regenera la sal de días pasados (debe dar error 'Sal caducada'):
-- select public.analytics_salt(current_date - 5);
-- select count(*) filter (where visitor is null) as viejos,
--        count(*) filter (where visitor is not null) as nuevos
--   from public.analytics_events;
-- select referrer, utm_source, count(*) from public.analytics_events
--  where created_at > now() - interval '7 days' group by 1, 2 order by 3 desc;
