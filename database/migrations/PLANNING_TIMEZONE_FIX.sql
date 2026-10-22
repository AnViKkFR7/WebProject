-- Planning — corrección de zona horaria de las tareas existentes
--
-- Hasta este arreglo, el formulario enviaba '2026-10-21T10:00' (hora local,
-- sin zona) y Postgres lo guardaba como 10:00 UTC. Con el código nuevo esas
-- tareas se pintarían a las 12:00 (11:00 en invierno). Este script reinterpreta
-- las tareas antiguas como hora de Madrid, que es lo que el usuario escribió.
--
-- EJECUTAR JUSTO AL DESPLEGAR el código nuevo, antes de que nadie edite tareas:
-- una tarea antigua editada con el código nuevo ya se guarda bien y NO debe
-- corregirse dos veces. Sustituye <FECHA_DESPLIEGUE> (p. ej. '2026-10-22 09:00+02').

-- 1) Revisar qué va a cambiar
select id, title,
       start_datetime as guardada,
       (start_datetime at time zone 'UTC') at time zone 'Europe/Madrid' as corregida
from public.planning_task
where created_at < '<FECHA_DESPLIEGUE>'
order by start_datetime;

-- 2) Aplicar
update public.planning_task
set start_datetime = (start_datetime at time zone 'UTC') at time zone 'Europe/Madrid',
    end_datetime   = (end_datetime   at time zone 'UTC') at time zone 'Europe/Madrid'
where created_at < '<FECHA_DESPLIEGUE>';

-- billing.billing_date es de tipo `date` (sin hora): no le afecta.
