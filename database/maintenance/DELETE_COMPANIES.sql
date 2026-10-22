-- Borrar empresas del panel (tabla companies) y TODO lo que cuelga de ellas
--
-- ⚠️ DESTRUCTIVO E IRREVERSIBLE. Borra items, atributos y sus valores, media,
-- blog, empresas cliente, tareas, facturación, analítica y solicitudes.
--
-- Supabase avisará de que la consulta incluye "operaciones destructivas".
-- Es correcto: esa es justo la intención. Revisa el paso 1 y continúa.
--
-- POR QUÉ ES UN SCRIPT Y NO UN `delete from companies`:
-- en la base de datos real las claves ajenas NO tienen ON DELETE CASCADE
-- (las tablas se crearon antes de que el esquema del repo lo declarara).
-- Un borrado directo falla con "violates foreign key constraint". Aquí se
-- borran los hijos en orden y al final la empresa.
--
-- NO BORRA LOS ARCHIVOS DE STORAGE: las imágenes y PDFs de los items
-- (bucket items-media) y los adjuntos de Planning (bucket media-planner)
-- hay que borrarlos a mano desde Supabase → Storage. Ver el paso 3.
--
-- Pegar en el SQL Editor de Supabase. EJECUTAR PRIMERO EL PASO 1.

-- ============================================================
-- 0) Qué empresas se van a borrar
-- ============================================================
-- Los ids salieron de una captura del panel: COMPRUEBA EN EL PASO 1 que los
-- nombres son los que esperas antes de seguir.
--
-- Están escritos dos veces, en el paso 1 y en el paso 2. Si cambias la
-- lista, cámbiala en los dos sitios. (No se usa una tabla temporal a
-- propósito: Supabase avisa de que una tabla nueva no tiene RLS, y aquí ese
-- aviso solo despista.)

-- ============================================================
-- 1) REVISAR — ejecuta SOLO esto primero
-- ============================================================
with objetivo as (
  select unnest(array[
    '0aad4a59-d6ee-47c9-bb9e-da5e2bb3fb48',
    '4caabda4-8395-44e0-aaa3-934f3d88e6eb',
    'a1e76258-820e-4657-85ba-3557a339a07f',
    'a910659f-030f-4269-aa4d-b397c3e84310'
  ]::uuid[]) as id
)
select coalesce(c.name, '*** ESTE ID NO EXISTE ***') as empresa,
       o.id,
       (select count(*) from public.items i                 where i.company_id  = o.id) as items,
       (select count(*) from public.attribute_definitions d where d.company_id  = o.id) as atributos,
       (select count(*) from public.blog_posts b            where b.company_id  = o.id) as blog,
       (select count(*) from public.client_company cc       where cc.company_id = o.id) as empresas_cliente,
       (select count(*) from public.planning_task t         where t.company_id  = o.id) as tareas,
       (select count(*) from public.billing bi              where bi.company_id = o.id) as facturas,
       (select count(*) from public.company_members m       where m.company_id  = o.id) as miembros
from objetivo o
left join public.companies c on c.id = o.id
order by 1;

-- Archivos que quedarán huérfanos en Storage (cópiate las rutas para el paso 3)
with objetivo as (
  select unnest(array[
    '0aad4a59-d6ee-47c9-bb9e-da5e2bb3fb48',
    '4caabda4-8395-44e0-aaa3-934f3d88e6eb',
    'a1e76258-820e-4657-85ba-3557a339a07f',
    'a910659f-030f-4269-aa4d-b397c3e84310'
  ]::uuid[]) as id
)
select m.url_externa
from public.item_media m
join public.items i on i.id = m.item_id
join objetivo o on o.id = i.company_id;

-- ============================================================
-- 2) BORRAR — solo cuando el paso 1 muestre lo que esperas
-- ============================================================
-- Todo va dentro de un bloque: o se borra entero o no se borra nada.
do $$
declare
  ids uuid[] := array[
    '0aad4a59-d6ee-47c9-bb9e-da5e2bb3fb48',
    '4caabda4-8395-44e0-aaa3-934f3d88e6eb',
    'a1e76258-820e-4657-85ba-3557a339a07f',
    'a910659f-030f-4269-aa4d-b397c3e84310'
  ]::uuid[];
  restantes integer;
begin
  -- Hijos de items
  delete from public.attribute_values v
   using public.items i
   where v.item_id = i.id and i.company_id = any(ids);

  delete from public.item_media m
   using public.items i
   where m.item_id = i.id and i.company_id = any(ids);

  delete from public.items where company_id = any(ids);

  -- Atributos (sus valores ya se han ido con los items)
  delete from public.attribute_definitions where company_id = any(ids);

  -- Blog
  delete from public.blog_media bm
   using public.blog_posts b
   where bm.post_id = b.id and b.company_id = any(ids);

  delete from public.blog_posts where company_id = any(ids);

  -- Planning: adjuntos → tareas y facturas → empresas cliente
  delete from public.attached_file af
   using public.planning_task t
   where af.task_id = t.id and t.company_id = any(ids);

  delete from public.attached_file af
   using public.billing bi
   where af.billing_id = bi.id and bi.company_id = any(ids);

  delete from public.planning_task where company_id = any(ids);
  delete from public.billing       where company_id = any(ids);

  delete from public.client_company_members cm
   using public.client_company cc
   where cm.client_company_id = cc.id and cc.company_id = any(ids);

  delete from public.client_company where company_id = any(ids);

  -- Tablas nuevas: estas sí tienen ON DELETE CASCADE, pero se borran aquí
  -- explícitamente para que el script funcione aunque alguna no exista aún.
  if to_regclass('public.lead') is not null then
    delete from public.lead where company_id = any(ids);
  end if;
  if to_regclass('public.analytics_events') is not null then
    delete from public.analytics_events where company_id = any(ids);
  end if;
  if to_regclass('public.analytics_daily') is not null then
    delete from public.analytics_daily where company_id = any(ids);
  end if;
  if to_regclass('public.analytics_event_definitions') is not null then
    delete from public.analytics_event_definitions where company_id = any(ids);
  end if;

  -- Miembros y, por fin, la empresa
  delete from public.company_members where company_id = any(ids);
  delete from public.companies       where id = any(ids);

  select count(*) into restantes from public.companies where id = any(ids);
  if restantes > 0 then
    raise exception 'Quedan % empresas sin borrar: se deshace todo', restantes;
  end if;

  raise notice 'Empresas borradas correctamente';
end $$;

-- Comprobación aparte: debe devolver 0 filas
select id, name from public.companies
where id = any(array[
  '0aad4a59-d6ee-47c9-bb9e-da5e2bb3fb48',
  '4caabda4-8395-44e0-aaa3-934f3d88e6eb',
  'a1e76258-820e-4657-85ba-3557a339a07f',
  'a910659f-030f-4269-aa4d-b397c3e84310'
]::uuid[]);

-- ============================================================
-- 3) DESPUÉS: limpiar Storage a mano
-- ============================================================
-- Supabase → Storage → items-media: borrar las carpetas de los items que
-- salieron en el paso 1. Igual en media-planner con los adjuntos de las
-- tareas y facturas borradas. SQL no toca los buckets.
--
-- Y en el panel: si alguien tenía una de estas empresas seleccionada, su
-- navegador la recuerda (moira.selectedCompany.<user>). Al entrar verá la
-- primera empresa disponible; no hace falta tocar nada.
