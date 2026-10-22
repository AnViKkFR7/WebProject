-- Atributos — orden y listas de opciones (Fase 3 del panel)
--
-- 1) sort_order: el orden en que se arrastran los atributos en /my-data es el
--    orden del formulario de items.
-- 2) validation_rules: para "Lista de opciones" se guarda {"options": [...]}.
--    El panel ya intentaba leer esta columna, pero nunca existió: por eso las
--    listas de opciones no funcionaban.
--
-- Idempotente. Pegar y ejecutar en el SQL Editor de Supabase ANTES de usar
-- el panel nuevo de Atributos (sin esto, reordenar y guardar opciones falla).

alter table public.attribute_definitions
  add column if not exists sort_order integer not null default 0,
  add column if not exists validation_rules jsonb;

-- Orden inicial = orden de creación, por tipo de item.
-- Solo toca los tipos que aún no se han ordenado (todo a 0).
with ranked as (
  select id,
         row_number() over (partition by company_id, item_type order by created_at, id) - 1 as pos
  from public.attribute_definitions d
  where not exists (
    select 1 from public.attribute_definitions o
    where o.company_id = d.company_id and o.item_type = d.item_type and o.sort_order <> 0
  )
)
update public.attribute_definitions d
set sort_order = ranked.pos
from ranked
where ranked.id = d.id;

create index if not exists attribute_definitions_type_order_idx
  on public.attribute_definitions (company_id, item_type, sort_order);
