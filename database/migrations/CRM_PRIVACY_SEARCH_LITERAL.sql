-- After CRM_PRIVACY_CONTROLS and COMPANY_MODULES_RPC_COMPLETION.
begin;
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
commit;
