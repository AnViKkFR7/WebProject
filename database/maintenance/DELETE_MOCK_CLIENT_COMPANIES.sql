-- Borrar las empresas cliente de prueba (tabla client_company)
--
-- Son las "empresas dentro de empresas" que lista /companies. Las referencian,
-- sin ON DELETE CASCADE:
--   planning_task.client_company_id, billing.client_company_id,
--   client_company_members.client_company_id
-- así que hay que soltar esas referencias antes de borrar.
--
-- Por defecto las TAREAS y FACTURAS se conservan y se quedan "sin empresa".
-- Si también eran de prueba, usa la variante B del paso 2.
--
-- Pegar en el SQL Editor de Supabase. Ejecutar primero solo el paso 1.

-- 1) Revisar qué hay y qué se verá afectado
select cc.id,
       cc.name,
       co.name as empresa_del_panel,
       (select count(*) from public.planning_task t where t.client_company_id = cc.id) as tareas,
       (select count(*) from public.billing b where b.client_company_id = cc.id)       as facturas,
       (select count(*) from public.client_company_members m where m.client_company_id = cc.id) as miembros
from public.client_company cc
left join public.companies co on co.id = cc.company_id
order by co.name, cc.name;

-- 2) Borrar (todo o nada)
begin;

-- Variante A (por defecto): conservar tareas y facturas, sin empresa cliente
update public.planning_task set client_company_id = null where client_company_id is not null;
update public.billing       set client_company_id = null where client_company_id is not null;

-- Variante B: si las tareas y facturas también eran de prueba, comenta las dos
-- líneas de arriba y descomenta estas (attached_file apunta a tareas y facturas):
-- delete from public.attached_file where task_id in (select id from public.planning_task where client_company_id is not null)
--                                     or billing_id in (select id from public.billing where client_company_id is not null);
-- delete from public.planning_task where client_company_id is not null;
-- delete from public.billing       where client_company_id is not null;

delete from public.client_company_members;
delete from public.client_company;

-- Comprobación: debe devolver 0
select count(*) as client_company_restantes from public.client_company;

commit;
