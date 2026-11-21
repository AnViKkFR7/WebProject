-- Auditoria 18-21: paquete incremental para Supabase SQL Editor.
-- Ejecutar UNA SOLA VEZ como postgres, sobre la BD existente con entregas previas aplicadas.
-- No es un bootstrap ni debe ejecutarse junto a las tres migraciones fuente.
-- Pausar scheduler semanal y esperar a workers anteriores antes de aplicar.
-- Despues: desplegar invite-user, listar-usuarios, send-weekly-summary y panel.
-- SITE_URL obligatorio y /reset-password permitido en Auth Redirect URLs.
-- Hallazgo 21: solo Edge, sin SQL adicional.
-- Todo el paquete se aplica en una unica transaccion; no envia correos.
-- Fuentes canonicas: database/migrations/. Ver docs/auditoria-cierre-18-21.md.

begin;


-- SOURCE: WEEKLY_SUMMARY_METRICS.sql
-- SHA256: d054d10f2edbb4c9443daa918b143eafc968c43c20dd99e1a96b3bef21c81628
-- After WEEKLY_SUMMARY_RETRY_WINDOW, BILLING_RECTIFICATION_BALANCES and PLANNING_RECURRENCE_WINDOW.
create function public.weekly_summary_issued_count(p_company uuid,p_from timestamptz,p_to timestamptz)
returns integer language sql stable security definer set search_path='' set row_security=off as $$
 select count(*)::int from (
  select e.record_id,min(e.created_at) first_issue from public.billing_document_events e
  where e.company_id=p_company and e.kind='invoice' and (
   e.action='created' and e.snapshot->>'status' in('issued','paid') or
   e.changes->>'status_after' in('issued','paid') and coalesce(e.changes->>'status_before','') not in('issued','paid'))
  and not exists(select 1 from public.billing_document_events baseline where baseline.company_id=e.company_id and baseline.kind='invoice'
   and baseline.record_id=e.record_id and baseline.action='baseline' and baseline.snapshot->>'status' in('issued','paid'))
  group by e.record_id
 ) firsts where first_issue>=p_from and first_issue<p_to;
$$;
create function public.weekly_summary_overdue_count(p_company uuid,p_today date)
returns integer language sql stable security definer set search_path='' set row_security=off as $$
 select count(*)::int from public.invoice_family_financials(p_company) f
 join public.invoices i on i.id=f.current_id and i.company_id=p_company
 where f.invoice_id=f.current_id and i.status='issued' and f.total-f.paid>0
 and public.billing_safe_document_date(i.document->>'dueDate')<p_today;
$$;
create function public.weekly_summary_planning_count(p_company uuid,p_from timestamptz,p_to timestamptz)
returns integer language sql stable security definer set search_path='' set row_security=off as $$
 with series as (
  select t.*,public.planning_recurrence_step(t.recurrence_type,t.recurrence_value) step
  from public.planning_task t where company_id=p_company and start_datetime<p_to
 ), occurrences as (
  select s.id,s.start_datetime occurrence_at from series s where step is null
  union all
  select s.id,public.planning_occurrence_at(s.start_datetime,s.step,n,s.recurrence_type)
  from series s cross join lateral generate_series(
   greatest(public.planning_recurrence_index(s.start_datetime,p_from,s.recurrence_type,s.recurrence_value)-1,0),
   greatest(public.planning_recurrence_index(s.start_datetime,p_to,s.recurrence_type,s.recurrence_value)+1,0)
  ) n where s.step is not null
 ) select count(*)::int from occurrences where occurrence_at>=p_from and occurrence_at<p_to;
$$;
revoke all on function public.weekly_summary_issued_count(uuid,timestamptz,timestamptz),public.weekly_summary_overdue_count(uuid,date),public.weekly_summary_planning_count(uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
create or replace function public.get_company_weekly_summary_payload(p_queue uuid)
returns table(company_id uuid,week_start date,week_end date,recipient_emails text[],new_leads integer,new_contacts integer,overdue_followups integer,issued_invoices integer,overdue_invoices integer,quotes_waiting integer,upcoming_planning integer,page_views integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_weekly_summary_queue; period_start timestamptz; period_end timestamptz; local_today date;
begin
  select * into q from public.company_weekly_summary_queue where id=p_queue and status='sending' and locked_at>now()-interval '10 minutes' and first_attempt_at>now()-interval '20 hours';
  if not found then return; end if;
  if not exists(select 1 from public.company_weekly_summary_settings s where s.company_id=q.company_id and s.enabled) then
    update public.company_weekly_summary_queue set status='skipped',locked_at=null,last_error_code='disabled',updated_at=now() where id=p_queue;
    return;
  end if;
  period_start:=q.week_start::timestamp at time zone 'Europe/Madrid';
  period_end:=(q.week_start+7)::timestamp at time zone 'Europe/Madrid';
  local_today:=(now() at time zone 'Europe/Madrid')::date;
  return query select q.company_id,q.week_start,q.week_start+6,
    coalesce((select array_agg(distinct u.email::text order by u.email::text) from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=q.company_id and m.role='admin' and m.is_active and nullif(btrim(u.email),'') is not null),array[]::text[]),
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.lead l where l.company_id=q.company_id and l.created_at>=period_start and l.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c where c.company_id=q.company_id and c.created_at>=period_start and c.created_at<period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'crm') then (select count(*)::int from public.crm_contacts c left join public.crm_pipeline_stages s on s.id=c.stage_id and s.company_id=c.company_id where c.company_id=q.company_id and c.next_follow_up_at<now() and not coalesce(s.is_won,false) and not coalesce(s.is_lost,false)) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then public.weekly_summary_issued_count(q.company_id,period_start,period_end) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then public.weekly_summary_overdue_count(q.company_id,local_today) else 0 end,
    case when public.is_company_module_enabled(q.company_id,'billing') then (select count(*)::int from public.quotes d where d.company_id=q.company_id and d.status='sent') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'planning') then public.weekly_summary_planning_count(q.company_id,period_end,(q.week_start+14)::timestamp at time zone 'Europe/Madrid') else 0 end,
    case when public.is_company_module_enabled(q.company_id,'analytics') then (select coalesce(sum(a.page_views),0)::int from public.analytics_daily a where a.company_id=q.company_id and a.day>=q.week_start and a.day<q.week_start+7) else 0 end;
end $$;


-- Patch the optional Watch payload only when already installed; never activate it.
do $patch$ declare definition text;begin
 if to_regprocedure('public.get_watch_weekly_summary_test_payload(uuid)') is not null then
  definition:=pg_get_functiondef('public.get_watch_weekly_summary_test_payload(uuid)'::regprocedure);
  if position('(select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind=''invoice'' and e.action=''status_changed'' and e.changes->>''status_after''=''issued'' and e.created_at>=period_start and e.created_at<period_end)' in definition)=0 then raise exception 'Unexpected Watch payload definition; review before applying';end if;
  definition:=replace(definition,'(select count(*)::int from public.billing_document_events e where e.company_id=q.company_id and e.kind=''invoice'' and e.action=''status_changed'' and e.changes->>''status_after''=''issued'' and e.created_at>=period_start and e.created_at<period_end)','public.weekly_summary_issued_count(q.company_id,period_start,period_end)');
  if position('(select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status=''issued'' and public.billing_safe_document_date(i.document->>''dueDate'')<local_today)' in definition)=0 then raise exception 'Unexpected Watch payload definition; review before applying';end if;
  definition:=replace(definition,'(select count(*)::int from public.invoices i where i.company_id=q.company_id and i.status=''issued'' and public.billing_safe_document_date(i.document->>''dueDate'')<local_today)','public.weekly_summary_overdue_count(q.company_id,local_today)');
  if position('(select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval ''7 days'')' in definition)=0 then raise exception 'Unexpected Watch payload definition; review before applying';end if;
  definition:=replace(definition,'(select count(*)::int from public.planning_task t where t.company_id=q.company_id and t.start_datetime>=period_end and t.start_datetime<period_end+interval ''7 days'')','public.weekly_summary_planning_count(q.company_id,period_end,(q.week_start+14)::timestamp at time zone ''Europe/Madrid'')');
  execute definition;
 end if;
end $patch$;
notify pgrst,'reload schema';


-- SOURCE: CRM_PRIVACY_SEARCH_LITERAL.sql
-- SHA256: 2d35ae09b3ad860c61aa521aac639acdc5eb5f96f27852372f63adfaca9e6531
-- After CRM_PRIVACY_CONTROLS and COMPANY_MODULES_RPC_COMPLETION.
create or replace function public.list_crm_privacy_contacts(p_company uuid,p_query text)
returns table(id uuid,name text,email text,phone text,created_at timestamptz)
language plpgsql security definer set search_path='' set row_security=off as $$
declare needle text;digits text;
begin
 perform public.assert_crm_privacy_admin(p_company);
 needle:=lower(btrim(coalesce(p_query,'')));
 if length(needle)<2 then return;end if;
 if length(needle)>320 then raise exception 'Invalid privacy search' using errcode='22023';end if;
 if needle ~ '^[0-9[:space:]()+.\-]+$' then digits:=regexp_replace(needle,'[^0-9]','','g');end if;
 return query select c.id,c.name,c.email,c.phone,c.created_at
 from public.crm_contacts c where c.company_id=p_company and (
  strpos(lower(c.name),needle)>0 or strpos(lower(coalesce(c.email,'')),needle)>0 or
  length(digits)>=2 and strpos(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),digits)>0
 ) order by c.updated_at desc,c.id limit 100;
end $$;
revoke all on function public.list_crm_privacy_contacts(uuid,text) from public,anon;
grant execute on function public.list_crm_privacy_contacts(uuid,text) to authenticated,service_role;
notify pgrst,'reload schema';


-- SOURCE: COMPANY_USER_INVITATION_STATE.sql
-- SHA256: 78794a56351dbcbe8b7b820972e3ee4266548c3e883918b44bd11b6cb1a70a56
-- After COMPANY_MEMBER_ACCESS. Internal orchestration only; no email is sent by SQL.
create table public.company_user_invitations(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 email text not null,full_name text not null,role text not null check(role in('editor','viewer')),
 requested_by uuid references auth.users(id) on delete set null,user_id uuid references auth.users(id) on delete set null,
 delivery_state text not null default 'idle' check(delivery_state in('idle','sending','accepted','failed','unknown','not_required')),
 lease_token uuid,locked_at timestamptz,last_attempt_at timestamptz,attempts integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,email)
);
alter table public.company_user_invitations enable row level security;
revoke all on public.company_user_invitations from public,anon,authenticated;
grant select,insert,update on public.company_user_invitations to service_role;
create function public.assert_invitation_operator(p_actor uuid) returns void
language plpgsql security definer set search_path='' set row_security=off as $$
begin
 if p_actor is null or not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'app_role'='admin') then
  raise exception 'Forbidden' using errcode='42501';end if;
end $$;
create function public.claim_company_user_invitation(p_actor uuid,p_company uuid,p_email text,p_name text,p_role text,p_resend boolean default false)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_user_invitations;matched uuid;identities integer;
begin
 perform public.assert_invitation_operator(p_actor);
 p_email:=lower(btrim(p_email));p_name:=btrim(p_name);
 if p_email is null or length(p_email) not between 3 and 320 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_name is null or length(p_name) not between 1 and 300 or p_role is null or p_role not in('editor','viewer') then raise exception 'Invalid invitation' using errcode='22023';end if;
 perform 1 from public.companies where id=p_company for update;
 if not found then raise exception 'Company unavailable' using errcode='P0002';end if;
 insert into public.company_user_invitations(company_id,email,full_name,role,requested_by)
 values(p_company,p_email,p_name,p_role,p_actor) on conflict(company_id,email) do nothing;
 select * into q from public.company_user_invitations where company_id=p_company and email=p_email for update;
 if q.delivery_state='sending' and q.locked_at>now()-interval '2 minutes' then raise exception 'Invitation in progress' using errcode='55P03';end if;
 if q.delivery_state='sending' then q.delivery_state:='unknown';end if;
 if q.delivery_state in('accepted','not_required','failed','unknown') and not coalesce(p_resend,false) then
  update public.company_user_invitations set delivery_state=q.delivery_state,locked_at=null,updated_at=now() where id=q.id;
  return jsonb_build_object('id',q.id,'can_send',false,'user_id',q.user_id,'delivery',q.delivery_state,
   'membership',exists(select 1 from public.company_members where company_id=p_company and user_id=q.user_id and is_active));
 end if;
 if q.last_attempt_at>now()-interval '60 seconds' then raise exception 'Invitation cooldown' using errcode='55P03';end if;
 select count(*),(array_agg(id))[1] into identities,matched from auth.users where lower(email)=p_email;
 if identities>1 then raise exception 'Ambiguous email identity' using errcode='22023';end if;
 update public.company_user_invitations set delivery_state='sending',user_id=matched,requested_by=p_actor,
 lease_token=gen_random_uuid(),locked_at=now(),last_attempt_at=now(),attempts=attempts+1,updated_at=now() where id=q.id returning * into q;
 return jsonb_build_object('id',q.id,'token',q.lease_token,'user_id',q.user_id,'can_send',true,'delivery',q.delivery_state);
end $$;
create function public.attach_company_user_invitation(p_id uuid,p_token uuid,p_user uuid default null)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_user_invitations;matched uuid;confirmed boolean;identities integer;member public.company_members;
begin
 select * into q from public.company_user_invitations where id=p_id for update;
 if not found or q.delivery_state<>'sending' or q.lease_token is distinct from p_token or q.locked_at<=now()-interval '2 minutes' then raise exception 'Invitation lease expired' using errcode='40001';end if;
 perform public.assert_invitation_operator(q.requested_by);
 select count(*),(array_agg(id))[1] into identities,matched from auth.users where lower(email)=q.email and (p_user is null or id=p_user);
 if identities<>1 then return jsonb_build_object('ready',false);end if;
 select email_confirmed_at is not null into confirmed from auth.users where id=matched;
 insert into public.company_members(company_id,user_id,role,full_name,created_by,last_edited_by)
 values(q.company_id,matched,q.role,q.full_name,q.requested_by,q.requested_by) on conflict(company_id,user_id) do nothing;
 select * into member from public.company_members where company_id=q.company_id and user_id=matched;
 update public.company_user_invitations set user_id=matched,updated_at=now() where id=q.id;
 return jsonb_build_object('ready',member.is_active,'user_id',matched,'confirmed',confirmed,'role',member.role);
end $$;
create function public.finish_company_user_invitation(p_id uuid,p_token uuid,p_delivery text)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.company_user_invitations;
begin
 if p_delivery is null or p_delivery not in('accepted','failed','unknown','not_required') then raise exception 'Invalid delivery state' using errcode='22023';end if;
 select * into q from public.company_user_invitations where id=p_id for update;
 if not found or q.delivery_state<>'sending' or q.lease_token is distinct from p_token then return false;end if;
 perform public.assert_invitation_operator(q.requested_by);
 update public.company_user_invitations set delivery_state=p_delivery,locked_at=null,updated_at=now() where id=p_id;
 return true;
end $$;
revoke all on function public.assert_invitation_operator(uuid),public.claim_company_user_invitation(uuid,uuid,text,text,text,boolean),public.attach_company_user_invitation(uuid,uuid,uuid),public.finish_company_user_invitation(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_company_user_invitation(uuid,uuid,text,text,text,boolean),public.attach_company_user_invitation(uuid,uuid,uuid),public.finish_company_user_invitation(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';


commit;
