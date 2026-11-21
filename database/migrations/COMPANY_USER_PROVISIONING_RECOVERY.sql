-- After COMPANY_USER_INVITATION_STATE. Preserve existing memberships; refresh pending request context.
begin;
create or replace function public.claim_company_user_invitation(p_actor uuid,p_company uuid,p_email text,p_name text,p_role text,p_resend boolean default false)
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
 update public.company_user_invitations set role=p_role,full_name=p_name where id=q.id;
 q.role:=p_role;q.full_name:=p_name;
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
notify pgrst,'reload schema';
commit;
