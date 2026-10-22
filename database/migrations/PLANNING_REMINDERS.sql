-- Planning — recordatorios por email
--
-- planning_task.reminders guarda minutos antes del inicio: {0, 60, 1440, 10080}
-- (al empezar, 1 hora, 1 día y 1 semana antes).
--
-- Un cron mira cada 5 minutos qué recordatorios tocan y llama a la Edge
-- Function `send-planning-reminders`, que es quien envía el correo.
-- planning_reminder_sent guarda lo ya enviado para no repetirlo.
--
-- Cubre también las tareas que se repiten: sus ocurrencias no son filas en la
-- base de datos, se calculan (paso 3) con las mismas reglas que el panel
-- (admin-panel/src/lib/recurrence.js): tope de 200 repeticiones y 3 años.
--
-- IMPORTANTE: nada de claves dentro de cron.schedule. El comando del cron se
-- guarda en claro en la tabla cron.job y lo puede leer cualquiera con acceso a
-- la base de datos. El secreto que autoriza la llamada va en Vault (paso 5),
-- y no es ninguna clave de Supabase: es un valor propio, así que la migración
-- a las claves nuevas (sb_secret_...) no obliga a tocar nada aquí.
--
-- REQUISITOS antes de ejecutar:
--   1) Comprobar que compila y desplegarla SIN verificación de JWT (la llama
--      el cron, no un usuario):
--        npm run check:functions
--        supabase functions deploy send-planning-reminders --no-verify-jwt
--      Si se despliega con un error de sintaxis, Supabase responde
--      503 BOOT_ERROR y no llega a ejecutarse nada.
--   2) Configurar sus secretos: RESEND_API_KEY, REMINDERS_FROM_EMAIL y
--      REMINDERS_CRON_SECRET (este último, el mismo valor que se guarda en
--      Vault en el paso 5).
--   3) Sustituir <PROJECT_REF> en el paso 5.
--
-- Idempotente. Pegar y ejecutar en el SQL Editor de Supabase.
--
-- ============================================================
-- SE EJECUTA EN DOS PARTES
--
-- PARTE A (pasos 1 a 4): la base. Se puede ejecutar ya. No envía nada,
--   solo deja preparadas la columna, el registro de envíos y el cálculo.
--   El panel ya guarda los recordatorios elegidos en cada tarea.
--
-- PARTE B (paso 5): el cron que dispara los envíos. Dejarlo para cuando el
--   dominio esté verificado en Resend y la función desplegada. Hasta
--   entonces NO hay que programarlo: llamaría a una función que no puede
--   enviar. Si ya lo programaste, mira el paso 0.
-- ============================================================

-- ============================================================
-- 0) LIMPIEZA — solo si ya programaste el cron con la clave dentro
-- ============================================================
-- ¿Existe el cron y lleva la clave a la vista?
--   select jobname, command from cron.job where jobname = 'planning-reminders';
--
-- Si sale, bórralo (y con él la clave que haya quedado guardada en claro):
--   select cron.unschedule('planning-reminders');
--
-- Si la clave llegó a guardarse en claro, conviene además ROTARLA en
-- Supabase: Settings -> API -> Reset service role key.

-- ============================================================
-- 1) Columna de recordatorios
-- ============================================================
alter table public.planning_task
  add column if not exists reminders integer[] not null default '{}';

create index if not exists planning_task_reminders_idx
  on public.planning_task (start_datetime)
  where cardinality(reminders) > 0;

-- ============================================================
-- 2) Registro de envíos (evita mandar dos veces el mismo)
-- ============================================================
create table if not exists public.planning_reminder_sent (
  task_id uuid not null references public.planning_task(id) on delete cascade,
  minutes_before integer not null,
  occurrence_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (task_id, minutes_before, occurrence_at)
);

alter table public.planning_reminder_sent enable row level security;

-- Solo lectura para quien puede ver la tarea; escribe la función con la
-- service role key, que se salta RLS.
drop policy if exists "planning_reminder_sent_select" on public.planning_reminder_sent;
create policy "planning_reminder_sent_select"
on public.planning_reminder_sent
for select
to authenticated
using (
  exists (
    select 1 from public.planning_task t
    where t.id = planning_reminder_sent.task_id
      and (public.is_platform_admin() or public.is_company_member(t.company_id))
  )
);

-- ============================================================
-- 3) Cada cuánto se repite una tarea
-- ============================================================
create or replace function public.planning_recurrence_step(_type text, _value integer)
returns interval
language sql
immutable
as $$
  select case _type
    when 'hourly' then make_interval(hours => greatest(coalesce(_value, 1), 1))
    when 'daily'  then make_interval(days  => greatest(coalesce(_value, 1), 1))
    when 'weekly' then make_interval(weeks => greatest(coalesce(_value, 1), 1))
    when 'yearly' then make_interval(years => greatest(coalesce(_value, 1), 1))
    else null
  end;
$$;

-- ============================================================
-- 4) Qué recordatorios tocan ahora
-- ============================================================
create or replace function public.planning_occurrence_at(_start timestamptz,_step interval,_n bigint,_type text)
returns timestamptz language sql immutable set search_path=pg_catalog as $$
  select case when _type='hourly' then _start+(_n*_step)
    else ((_start at time zone 'Europe/Madrid')+(_n*_step)) at time zone 'Europe/Madrid' end;
$$;
create or replace function public.due_planning_reminders(window_minutes integer default 10)
returns table (
  task_id uuid,
  title text,
  occurrence_at timestamptz,
  minutes_before integer,
  company_id uuid,
  created_by uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with pending as (
    select t.id, t.title, t.start_datetime, t.company_id, t.created_by,t.recurrence_type,
           m.minutes_before,
           public.planning_recurrence_step(t.recurrence_type, t.recurrence_value) as step
    from public.planning_task t
    cross join unnest(t.reminders) as m(minutes_before)
    where cardinality(t.reminders) > 0
  ),
  -- Ventana en la que debe caer la ocurrencia para que toque avisar ahora
  windowed as (
    select p.*,
           now() - make_interval(mins => window_minutes) + make_interval(mins => p.minutes_before) as win_from,
           now() + make_interval(mins => p.minutes_before) as win_to
    from pending p
  ),
  candidates as (
    -- Tareas que no se repiten: su única fecha
    select w.id, w.title, w.start_datetime as occurrence_at,
           w.minutes_before, w.company_id, w.created_by
    from windowed w
    where w.step is null
      and w.start_datetime between w.win_from and w.win_to

    union all

    -- Tareas que se repiten: se estima qué repetición cae en la ventana y se
    -- comprueban tres candidatas alrededor, por si la estimación se desvía
    -- (el paso 'yearly' no dura siempre lo mismo).
    select w.id, w.title, public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type),
           w.minutes_before, w.company_id, w.created_by
    from windowed w
    cross join lateral (
      select generate_series(
        greatest(
          floor(extract(epoch from (w.win_from - w.start_datetime))
                / nullif(extract(epoch from w.step), 0))::bigint - 1,
          0),
        greatest(
          floor(extract(epoch from (w.win_from - w.start_datetime))
                / nullif(extract(epoch from w.step), 0))::bigint + 1,
          0)
      ) as n
    ) k
    where w.step is not null
      and k.n <= 200                                   -- mismo tope que el panel
      and public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type) between w.win_from and w.win_to
      and public.planning_occurrence_at(w.start_datetime,w.step,k.n,w.recurrence_type) <= now() + interval '3 years'
  )
  select c.id, c.title, c.occurrence_at, c.minutes_before, c.company_id, c.created_by
  from candidates c
  where not exists (
    select 1 from public.planning_reminder_sent s
    where s.task_id = c.id
      and s.minutes_before = c.minutes_before
      and s.occurrence_at = c.occurrence_at
  );
$$;

-- Nadie la llama desde el panel: solo el cron, con la service role key.
-- OJO: 'revoke ... from public' se lo quita a TODOS los roles, service_role
-- incluido, así que hay que volver a dárselo explícitamente o la función
-- falla con "permission denied for function".
revoke all on function public.due_planning_reminders(integer) from public, anon, authenticated;
grant execute on function public.due_planning_reminders(integer) to service_role;


-- ============================================================
-- 5) PARTE B — Cron cada 5 minutos
--    NO ejecutar hasta tener el dominio verificado en Resend y la función
--    desplegada. Todo lo de arriba funciona sin esto.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- El cron NO manda ninguna clave de Supabase: manda un secreto propio, el
-- mismo que tiene la función en REMINDERS_CRON_SECRET. Así da igual que
-- Supabase cambie de claves (sb_secret_... en lugar de la service role key).
--
-- Genera el secreto y guárdalo cifrado en Vault (UNA vez). Esta consulta lo
-- crea y te lo muestra: cópialo para ponerlo también como secreto de la
-- función, en REMINDERS_CRON_SECRET.
--
-- select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
--                            'planning_reminders_cron_secret',
--                            'Secreto que autoriza al cron a llamar a la función');
-- select decrypted_secret from vault.decrypted_secrets
--  where name = 'planning_reminders_cron_secret';
--
-- Para cambiarlo más adelante (hay que actualizarlo también en la función):
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'planning_reminders_cron_secret'),
--   replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

select cron.unschedule('planning-reminders')
where exists (select 1 from cron.job where jobname = 'planning-reminders');

select cron.schedule(
  'planning-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-planning-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminders-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'planning_reminders_cron_secret'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- 6) PROBARLO SIN ESPERAR AL CRON
-- ============================================================
-- 1. En el panel, crea una tarea cuyo inicio sea DENTRO DE UNOS MINUTOS y
--    marca el recordatorio "Al empezar". La tarea tiene que tener un creador
--    (created_by) con email: el aviso se le manda a esa persona.
--
-- 2. Cuando llegue la hora de inicio, mira si el sistema ya la ve pendiente.
--    Si devuelve 0 filas, aún no toca (o ya se envió):
--      select * from public.due_planning_reminders(10);
--
-- 3. Dispara el envío a mano, con la clave sacada de Vault (no hace falta
--    pegarla en ningún sitio):
--      select net.http_post(
--        url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-planning-reminders',
--        headers := jsonb_build_object(
--          'Content-Type', 'application/json',
--          'x-reminders-secret', (
--            select decrypted_secret from vault.decrypted_secrets
--            where name = 'planning_reminders_cron_secret')),
--        body    := '{}'::jsonb
--      );
--
-- 4. Comprueba que ha quedado registrado como enviado:
--      select * from public.planning_reminder_sent order by sent_at desc limit 5;
--
-- Si la función responde 403, el motivo viene en la respuesta:
--   select status_code, content from net._http_response order by created desc limit 3;
--
--   "falta la cabecera x-reminders-secret"  -> el secreto no existe en Vault
--       con ese nombre exacto, así que el subselect devuelve NULL. Comprueba:
--         select name, length(decrypted_secret) as longitud,
--                left(decrypted_secret, 6) as empieza_por
--         from vault.decrypted_secrets
--         where name = 'planning_reminders_cron_secret';
--       Si no devuelve ninguna fila, créalo (arriba, paso 5).
--
--   "el secreto no coincide..."  -> existe, pero no es el mismo valor que
--       REMINDERS_CRON_SECRET en los secretos de la función. Compara el
--       'empieza_por' de la consulta de arriba con lo que pusiste allí, y
--       vuelve a poner el mismo valor en los dos sitios.
--
-- Otras comprobaciones
-- select * from cron.job where jobname = 'planning-reminders';
-- select * from cron.job_run_details order by start_time desc limit 5;
-- select * from net._http_response order by created desc limit 5;  -- respuesta de la función
