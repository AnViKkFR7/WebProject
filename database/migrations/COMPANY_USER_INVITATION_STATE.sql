-- After COMPANY_MEMBER_ACCESS. Internal orchestration only; no email is sent by SQL.
begin;
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
