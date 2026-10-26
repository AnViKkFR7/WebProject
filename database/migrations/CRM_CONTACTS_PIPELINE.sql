-- CRM multiempresa: contactos, etapas, trazabilidad de actividades y vínculo automático de leads.
-- Aplicar después de DB_SCHEMA.sql y LEADS_SCHEMA.sql. No elimina ni fusiona registros existentes.
begin;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text,
  phone text,
  email_normalized text generated always as (nullif(pg_catalog.lower(pg_catalog.btrim(email)), '')) stored,
  phone_normalized text generated always as (nullif(pg_catalog.regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')) stored,
  assigned_to uuid references auth.users(id) on delete set null,
  next_follow_up_at timestamptz,
  source_path text,
  source_referrer text,
  source_utm_source text,
  source_utm_medium text,
  source_utm_campaign text,
  source_utm_term text,
  source_utm_content text,
  consent_given boolean not null default false,
  consent_at timestamptz,
  consent_text_version text,
  consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, assigned_to)
    references public.company_members(company_id, user_id) on delete set null (assigned_to)
);

create index if not exists crm_contacts_company_name_idx
  on public.crm_contacts(company_id, lower(name));
create index if not exists crm_contacts_company_email_idx
  on public.crm_contacts(company_id, email_normalized) where email_normalized is not null;
create index if not exists crm_contacts_company_phone_idx
  on public.crm_contacts(company_id, phone_normalized) where phone_normalized is not null;
create index if not exists crm_contacts_assigned_idx
  on public.crm_contacts(company_id, assigned_to, updated_at desc);

create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  stage_key text not null check (stage_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position integer not null check (position >= 0),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, id),
  unique(company_id, stage_key),
  check (not (is_won and is_lost))
);

create index if not exists crm_pipeline_stages_order_idx
  on public.crm_pipeline_stages(company_id, position) where is_active;

alter table public.crm_contacts add column if not exists stage_id uuid;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.crm_contacts'::regclass and conname='crm_contacts_stage_same_company_fk') then
    alter table public.crm_contacts add constraint crm_contacts_stage_same_company_fk
      foreign key(company_id,stage_id) references public.crm_pipeline_stages(company_id,id) on delete set null (stage_id);
  end if;
end $$;

-- Se conserva la tabla de solicitudes como bandeja de entrada y fuente original.
alter table public.lead
  add column if not exists crm_contact_id uuid,
  add column if not exists crm_stage_id uuid,
  add column if not exists crm_match_state text not null default 'unprocessed',
  add column if not exists source_referrer text,
  add column if not exists source_utm_source text,
  add column if not exists source_utm_medium text,
  add column if not exists source_utm_term text,
  add column if not exists source_utm_content text,
  add column if not exists consent_given boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_text_version text,
  add column if not exists consent_source text;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.lead'::regclass and conname='lead_company_id_id_unique') then
    alter table public.lead add constraint lead_company_id_id_unique unique(company_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.lead'::regclass and conname='lead_crm_match_state_check') then
    alter table public.lead add constraint lead_crm_match_state_check check (crm_match_state in ('unprocessed','linked','review_required'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.lead'::regclass and conname='lead_crm_contact_same_company_fk') then
    alter table public.lead add constraint lead_crm_contact_same_company_fk
      foreign key(company_id,crm_contact_id) references public.crm_contacts(company_id,id) on delete set null (crm_contact_id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.lead'::regclass and conname='lead_crm_stage_same_company_fk') then
    alter table public.lead add constraint lead_crm_stage_same_company_fk
      foreign key(company_id,crm_stage_id) references public.crm_pipeline_stages(company_id,id) on delete set null (crm_stage_id);
  end if;
end $$;

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid,
  lead_id uuid,
  kind text not null check (kind in ('form','email','call','note','visit','quote','invoice','system')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  details text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key(company_id,contact_id) references public.crm_contacts(company_id,id) on delete set null (contact_id),
  foreign key(company_id,lead_id) references public.lead(company_id,id) on delete set null (lead_id),
  check (contact_id is not null or lead_id is not null)
);

create index if not exists crm_activities_contact_timeline_idx
  on public.crm_activities(company_id,contact_id,occurred_at desc);
create index if not exists crm_activities_lead_idx
  on public.crm_activities(company_id,lead_id,occurred_at desc);

-- Etapas iniciales por compañía. El catálogo es editable posteriormente por admin/editor.
insert into public.crm_pipeline_stages(company_id,stage_key,name,position,is_won,is_lost)
select c.id, s.stage_key, s.name, s.position, s.is_won, s.is_lost
from public.companies c
cross join (values
  ('new','Nuevo',0,false,false),
  ('contacted','Contactado',1,false,false),
  ('visit','Visita',2,false,false),
  ('offer','Oferta',3,false,false),
  ('closed_won','Cerrado',4,true,false),
  ('closed_lost','Perdido',5,false,true)
) as s(stage_key,name,position,is_won,is_lost)
on conflict(company_id,stage_key) do nothing;

-- Conserva el estado de solicitudes antiguas cerradas sin asumir si fueron ganadas o perdidas.
insert into public.crm_pipeline_stages(company_id,stage_key,name,position,is_won,is_lost)
select distinct l.company_id,'legacy_closed','Cierre previo (sin clasificar)',6,false,false
from public.lead l where l.status='closed'
on conflict(company_id,stage_key) do nothing;

create or replace function public.initialize_crm_pipeline()
returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.crm_pipeline_stages(company_id,stage_key,name,position,is_won,is_lost)
  values
    (new.id,'new','Nuevo',0,false,false),
    (new.id,'contacted','Contactado',1,false,false),
    (new.id,'visit','Visita',2,false,false),
    (new.id,'offer','Oferta',3,false,false),
    (new.id,'closed_won','Cerrado',4,true,false),
    (new.id,'closed_lost','Perdido',5,false,true)
  on conflict(company_id,stage_key) do nothing;
  return new;
end $$;

drop trigger if exists companies_initialize_crm_pipeline on public.companies;
create trigger companies_initialize_crm_pipeline after insert on public.companies
for each row execute function public.initialize_crm_pipeline();

create or replace function public.process_crm_lead(target_lead_id uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare
  incoming public.lead%rowtype;
  matches uuid[];
  matched_id uuid;
  default_stage uuid;
begin
  select * into incoming from public.lead where id=target_lead_id;
  if not found or incoming.crm_match_state <> 'unprocessed' then return; end if;

  -- Serializa la deduplicación por compañía para evitar dos contactos al mismo tiempo.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(incoming.company_id::text, 83421));
  select id into default_stage from public.crm_pipeline_stages
    where company_id=incoming.company_id and stage_key=case incoming.status
      when 'contacted' then 'contacted' when 'closed' then 'legacy_closed' else 'new' end;

  if nullif(pg_catalog.lower(pg_catalog.btrim(incoming.email)), '') is not null
     or nullif(pg_catalog.regexp_replace(coalesce(incoming.phone,''), '[^0-9]', '', 'g'), '') is not null then
    select pg_catalog.array_agg(distinct c.id order by c.id) into matches
    from public.crm_contacts c
    where c.company_id=incoming.company_id
      and ((nullif(pg_catalog.lower(pg_catalog.btrim(incoming.email)), '') is not null and c.email_normalized=pg_catalog.lower(pg_catalog.btrim(incoming.email)))
        or (nullif(pg_catalog.regexp_replace(coalesce(incoming.phone,''), '[^0-9]', '', 'g'), '') is not null and c.phone_normalized=pg_catalog.regexp_replace(coalesce(incoming.phone,''), '[^0-9]', '', 'g')));
  end if;

  if coalesce(pg_catalog.cardinality(matches),0) > 1 then
    update public.lead set crm_match_state='review_required',crm_contact_id=null
      where id=incoming.id;
    insert into public.crm_activities(company_id,lead_id,kind,title,details,occurred_at)
      values(incoming.company_id,incoming.id,'form','Solicitud pendiente de vinculación','El email y el teléfono coinciden con contactos distintos. Requiere revisión manual.',incoming.created_at);
    return;
  elsif coalesce(pg_catalog.cardinality(matches),0)=1 then
    matched_id:=matches[1];
  else
    insert into public.crm_contacts(company_id,name,email,phone,stage_id,source_path,source_referrer,
      source_utm_source,source_utm_medium,source_utm_campaign,source_utm_term,source_utm_content,
      consent_given,consent_at,consent_text_version,consent_source,assigned_to)
    values(incoming.company_id,incoming.name,incoming.email,incoming.phone,default_stage,incoming.source_path,incoming.source_referrer,
      incoming.source_utm_source,incoming.source_utm_medium,incoming.source_campaign,incoming.source_utm_term,incoming.source_utm_content,
      incoming.consent_given,incoming.consent_at,incoming.consent_text_version,incoming.consent_source,incoming.handled_by)
    returning id into matched_id;
  end if;

  select stage_id into default_stage from public.crm_contacts where id=matched_id;
  if default_stage is null then
    select id into default_stage from public.crm_pipeline_stages where company_id=incoming.company_id and stage_key='new';
    update public.crm_contacts set stage_id=default_stage where id=matched_id;
  end if;
  update public.lead set crm_contact_id=matched_id,crm_stage_id=coalesce(crm_stage_id,default_stage),crm_match_state='linked'
    where id=incoming.id;
  insert into public.crm_activities(company_id,contact_id,lead_id,kind,title,details,occurred_at)
    values(incoming.company_id,matched_id,incoming.id,'form','Solicitud recibida',incoming.message,incoming.created_at);
end $$;

create or replace function public.link_new_crm_lead()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
begin
  perform public.process_crm_lead(new.id);
  return new;
end $$;

drop trigger if exists lead_link_crm_contact on public.lead;
create trigger lead_link_crm_contact after insert on public.lead
for each row execute function public.link_new_crm_lead();

-- Backfill de solicitudes existentes; no modifica ni fusiona contactos preexistentes.
update public.lead set crm_match_state='unprocessed', crm_contact_id=null where crm_match_state='unprocessed';
do $$ declare row record; begin
  for row in select id from public.lead where crm_match_state='unprocessed' order by created_at,id loop
    perform public.process_crm_lead(row.id);
  end loop;
end $$;

-- Impide falsificar la vinculación automática desde una sesión autenticada.
create or replace function public.protect_crm_lead_link()
returns trigger language plpgsql set search_path='' as $$
begin
  if current_user='authenticated' and (new.crm_contact_id is distinct from old.crm_contact_id or new.crm_match_state is distinct from old.crm_match_state) then
    raise exception 'CRM lead linkage is system-managed' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists lead_protect_crm_link on public.lead;
create trigger lead_protect_crm_link before update on public.lead
for each row execute function public.protect_crm_lead_link();

create or replace function public.touch_crm_contact_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=pg_catalog.now(); return new; end $$;
drop trigger if exists crm_contacts_touch_updated_at on public.crm_contacts;
create trigger crm_contacts_touch_updated_at before update on public.crm_contacts
for each row execute function public.touch_crm_contact_updated_at();

create or replace function public.resolve_crm_lead_contact(
  p_company uuid,p_lead uuid,p_contact uuid default null,p_create_contact boolean default false
)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare incoming public.lead%rowtype; resolved_id uuid; new_stage uuid;
begin
  if not public.has_company_role(p_company,array['admin','editor']) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into incoming from public.lead where id=p_lead and company_id=p_company for update;
  if not found or incoming.crm_match_state<>'review_required' then
    raise exception 'Lead is not awaiting CRM review' using errcode='22023';
  end if;
  if p_create_contact is true then
    if p_contact is not null then raise exception 'Choose a contact or create one, not both' using errcode='22023'; end if;
    select id into new_stage from public.crm_pipeline_stages where company_id=p_company and stage_key='new';
    insert into public.crm_contacts(company_id,name,email,phone,stage_id,source_path,source_referrer,
      source_utm_source,source_utm_medium,source_utm_campaign,source_utm_term,source_utm_content,
      consent_given,consent_at,consent_text_version,consent_source)
    values(p_company,incoming.name,incoming.email,incoming.phone,new_stage,incoming.source_path,incoming.source_referrer,
      incoming.source_utm_source,incoming.source_utm_medium,incoming.source_campaign,incoming.source_utm_term,incoming.source_utm_content,
      incoming.consent_given,incoming.consent_at,incoming.consent_text_version,incoming.consent_source)
    returning id into resolved_id;
  else
    if p_contact is null then raise exception 'A contact must be selected' using errcode='22023'; end if;
    select id,stage_id into resolved_id,new_stage from public.crm_contacts where id=p_contact and company_id=p_company;
    if not found then raise exception 'Contact not found in company' using errcode='42501'; end if;
    new_stage:=coalesce(new_stage,(select id from public.crm_pipeline_stages where company_id=p_company and stage_key='new'));
  end if;
  update public.lead set crm_contact_id=resolved_id,crm_stage_id=new_stage,crm_match_state='linked' where id=p_lead;
  insert into public.crm_activities(company_id,contact_id,lead_id,kind,title,details,created_by)
    values(p_company,resolved_id,p_lead,'system','Solicitud vinculada manualmente',
      case when p_create_contact then 'Se creó un contacto nuevo desde la bandeja de solicitudes.' else 'La persona del equipo seleccionó un contacto existente tras revisión manual.' end,
      auth.uid());
  return resolved_id;
end $$;

create or replace function public.guard_crm_stage_archive()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.is_active and not new.is_active and exists(
    select 1 from public.crm_contacts c where c.company_id=old.company_id and c.stage_id=old.id
  ) then
    raise exception 'Move all contacts out of this stage before archiving it' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists crm_stage_archive_guard on public.crm_pipeline_stages;
create trigger crm_stage_archive_guard before update of is_active on public.crm_pipeline_stages
for each row execute function public.guard_crm_stage_archive();

alter table public.crm_contacts enable row level security;
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_activities enable row level security;

drop policy if exists crm_contacts_select_tenant on public.crm_contacts;
create policy crm_contacts_select_tenant on public.crm_contacts for select to authenticated
using(public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists crm_contacts_insert_tenant on public.crm_contacts;
create policy crm_contacts_insert_tenant on public.crm_contacts for insert to authenticated
with check(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor']));
drop policy if exists crm_contacts_update_tenant on public.crm_contacts;
create policy crm_contacts_update_tenant on public.crm_contacts for update to authenticated
using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor']))
with check(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor']));

drop policy if exists crm_pipeline_stages_select_tenant on public.crm_pipeline_stages;
create policy crm_pipeline_stages_select_tenant on public.crm_pipeline_stages for select to authenticated
using(public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists crm_pipeline_stages_write_tenant on public.crm_pipeline_stages;
create policy crm_pipeline_stages_write_tenant on public.crm_pipeline_stages for all to authenticated
using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor']))
with check(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor']));

drop policy if exists crm_activities_select_tenant on public.crm_activities;
create policy crm_activities_select_tenant on public.crm_activities for select to authenticated
using(public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists crm_activities_insert_tenant on public.crm_activities;
create policy crm_activities_insert_tenant on public.crm_activities for insert to authenticated
with check(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor']));

grant select,insert,update on public.crm_contacts,public.crm_pipeline_stages to authenticated;
grant select,insert on public.crm_activities to authenticated;
revoke all on public.crm_contacts,public.crm_pipeline_stages,public.crm_activities from anon;
revoke update,delete on public.crm_activities from authenticated;
revoke all on function public.process_crm_lead(uuid) from public,anon,authenticated;
revoke all on function public.link_new_crm_lead() from public,anon,authenticated;
revoke all on function public.initialize_crm_pipeline() from public,anon,authenticated;
revoke all on function public.protect_crm_lead_link() from public,anon,authenticated;
revoke all on function public.touch_crm_contact_updated_at() from public,anon,authenticated;
revoke all on function public.resolve_crm_lead_contact(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.resolve_crm_lead_contact(uuid,uuid,uuid,boolean) to authenticated,service_role;
revoke all on function public.guard_crm_stage_archive() from public,anon,authenticated;
commit;
