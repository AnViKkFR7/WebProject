-- Analítica propia por empresa — Fase 2 (agregación), v2
-- Ver admin-panel/new_feature.md §5 y admin-panel/roadmap.md
--
-- Requiere ANALYTICS_SCHEMA.sql ya ejecutado, y la extensión pg_cron
-- activada (Dashboard de Supabase → Database → Extensions → pg_cron).
--
-- Cambios respecto a v1: agregación varias veces al día (no solo de
-- madrugada) para que el dashboard se actualice durante el día, más una
-- función RPC para que el propio admin pueda forzar una agregación
-- inmediata de su empresa (botón "Agregar ahora").
--
-- Pegar y ejecutar en el SQL Editor de Supabase. Es idempotente: se puede
-- re-ejecutar sin duplicar cron jobs ni romper nada.

create extension if not exists pg_cron;

-- ============================================================
-- 1) Agregación (compartida entre el cron y el RPC manual)
-- Si target_company_id es null, agrega TODAS las empresas con eventos ese
-- día (uso del cron). Si se pasa un company_id, agrega solo esa empresa
-- (uso del botón "Agregar ahora" desde el admin).
-- security definer: corre con permisos elevados porque analytics_events y
-- analytics_daily no tienen política de insert/update para authenticated.
-- ============================================================
-- NOTA: device, country y lang cuentan SOLO visitas (page_view). Antes contaban
-- todos los eventos; con scroll y tiempo en página (hasta 5 eventos extra por
-- página) saldrían inflados 5 o 6 veces.
create or replace function public.aggregate_analytics_rollup(target_day date, target_company_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_daily (
    company_id, day, unique_visitors, page_views, by_path, by_device, by_country, by_event,
    by_source, by_lang, by_scroll, by_engagement, by_not_found
  )
  select
    e.company_id,
    target_day,
    -- visitor lo calcula el servidor (sal del día + IP + UA). Para los
    -- eventos antiguos, anteriores a ANALYTICS_PRIVACY_UPGRADE.sql, se
    -- recurre a session_id para no perder el histórico.
    count(distinct coalesce(e.visitor, e.session_id)) filter (where e.event_type = 'page_view'),
    count(*) filter (where e.event_type = 'page_view'),
    coalesce((
      select jsonb_object_agg(path, cnt) from (
        select path, count(*) cnt from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'page_view' and path is not null
        group by path
      ) s
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(device, cnt) from (
        select device, count(*) cnt from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'page_view' and device is not null
        group by device
      ) s
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(country, cnt) from (
        select country, count(*) cnt from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'page_view' and country is not null
        group by country
      ) s
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(event_key, cnt) from (
        select event_key, count(*) cnt from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'cta_click'
        group by event_key
      ) s
    ), '{}'::jsonb),
    -- De dónde vino: campaña, si no el dominio de origen, si no directo
    coalesce((
      select jsonb_object_agg(source, cnt) from (
        select coalesce(nullif(utm_source, ''), nullif(referrer, ''), '(directo)') as source,
               count(*) cnt
        from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'page_view'
        group by 1
      ) s
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(lang, cnt) from (
        select lang, count(*) cnt from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'page_view' and lang is not null
        group by lang
      ) s
    ), '{}'::jsonb),
    -- Hasta dónde se lee cada página: { "/servicios": { "25": 40, "50": 22, ... } }
    coalesce((
      select jsonb_object_agg(path, depths) from (
        select path, jsonb_object_agg(value::text, cnt) as depths from (
          select path, value, count(*) cnt from public.analytics_events
          where company_id = e.company_id and created_at::date = target_day
            and event_type = 'scroll_depth' and path is not null and value is not null
          group by path, value
        ) per_depth
        group by path
      ) per_path
    ), '{}'::jsonb),
    -- Tiempo en página por tramos. "Rebote" = el tramo lt10 (menos de 10 s).
    coalesce((
      select jsonb_object_agg(bucket, cnt) from (
        select case
                 when value < 10  then 'lt10'
                 when value < 30  then '10_30'
                 when value < 60  then '30_60'
                 when value < 180 then '60_180'
                 else 'gt180'
               end as bucket,
               count(*) cnt
        from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'engagement' and value is not null
        group by 1
      ) s
    ), '{}'::jsonb),
    -- Páginas que no existen: { "/viejo": 12 }
    coalesce((
      select jsonb_object_agg(path, cnt) from (
        select path, count(*) cnt from public.analytics_events
        where company_id = e.company_id and created_at::date = target_day
          and event_type = 'not_found' and path is not null
        group by path
      ) s
    ), '{}'::jsonb)
  from public.analytics_events e
  where e.created_at::date = target_day
    and (target_company_id is null or e.company_id = target_company_id)
  group by e.company_id
  on conflict (company_id, day) do update set
    unique_visitors = excluded.unique_visitors,
    page_views      = excluded.page_views,
    by_path         = excluded.by_path,
    by_device       = excluded.by_device,
    by_country      = excluded.by_country,
    by_event        = excluded.by_event,
    by_source       = excluded.by_source,
    by_lang         = excluded.by_lang,
    by_scroll       = excluded.by_scroll,
    by_engagement   = excluded.by_engagement,
    by_not_found    = excluded.by_not_found;
end;
$$;

-- ============================================================
-- 2) Purga de eventos en crudo (> 35 días). Separada de la agregación para
-- que solo corra una vez al día, no en cada pasada intradía.
-- ============================================================
create or replace function public.purge_old_analytics_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.analytics_events where created_at < now() - interval '35 days';
end;
$$;

-- ============================================================
-- 3) RPC para el botón "Agregar ahora" del admin panel. Comprueba permisos
-- ella misma (no depende de RLS, que no cubre funciones) — solo un
-- admin/editor de ESA empresa (o un platform admin) puede forzarlo, y solo
-- para el día de hoy, nunca para fechas pasadas arbitrarias.
-- ============================================================
create or replace function public.trigger_company_analytics_aggregation(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_platform_admin()
    or public.has_company_role(target_company_id, array['admin', 'editor'])
  ) then
    raise exception 'not authorized';
  end if;

  perform public.aggregate_analytics_rollup(current_date, target_company_id);
end;
$$;

grant execute on function public.trigger_company_analytics_aggregation(uuid) to authenticated;

-- ============================================================
-- 4) Cron: agregación intradía (todas las empresas, día de HOY) a las
-- 10:00, 12:00, 14:00, 16:00 y 18:00 hora de Madrid, más un cierre
-- definitivo del día de AYER + purga de madrugada.
--
-- pg_cron programa en UTC. Las horas de abajo son la aproximación en
-- horario de invierno (CET, UTC+1) — en horario de verano (CEST, UTC+2)
-- se ejecutan una hora antes de lo esperado (ej. las "10:00" caen a las
-- 09:00 hora de Madrid). Si eso importa, ajusta manualmente los números
-- de hora dos veces al año, o cambia el offset aquí abajo.
-- ============================================================
select cron.unschedule(jobid) from cron.job where jobname = 'aggregate-analytics-daily';
select cron.unschedule(jobid) from cron.job where jobname = 'aggregate-analytics-intraday';
select cron.unschedule(jobid) from cron.job where jobname = 'purge-analytics-events';

-- Cierre del día anterior + purga, 03:00 UTC (≈ 04:00 Madrid en invierno)
select cron.schedule(
  'aggregate-analytics-daily',
  '0 3 * * *',
  $$select public.aggregate_analytics_rollup(current_date - 1)$$
);

select cron.schedule(
  'purge-analytics-events',
  '10 3 * * *',
  $$select public.purge_old_analytics_events()$$
);

-- Agregación intradía del día de HOY, a las 09/11/13/15/17h UTC
-- (≈ 10/12/14/16/18h Madrid en invierno)
select cron.schedule(
  'aggregate-analytics-intraday',
  '0 9,11,13,15,17 * * *',
  $$select public.aggregate_analytics_rollup(current_date)$$
);

-- Verificación manual:
-- select public.aggregate_analytics_rollup(current_date);
-- select * from public.analytics_daily order by day desc, company_id limit 10;
--
-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 10;

-- FIN DE LA AGREGACIÓN
