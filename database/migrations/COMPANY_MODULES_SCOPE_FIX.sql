-- Adds the module switch to billing RPCs that were introduced after the
-- original COMPANY_MODULES migration. Apply after COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql,
-- BILLING_QUOTE_APPROVAL_REVISIONS.sql and BILLING_QUOTE_APPROVAL_DASHBOARD_HANDLING.sql.
begin;

create or replace function public.assert_company_module_enabled(p_company uuid,p_module text)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if p_company is null or p_module is null or p_module not in('items','blog','crm','planning','billing','analytics')
    or not public.is_company_module_enabled(p_company,p_module) then
    raise exception 'Company module is disabled' using errcode='42501';
  end if;
end $$;
revoke all on function public.assert_company_module_enabled(uuid,text) from public,anon,authenticated,service_role;

create or replace function public.get_company_customer_email_settings(p_company uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  select s.settings into result from public.company_customer_email_settings s where s.company_id=p_company;
  return coalesce(result,public.default_company_customer_email_settings());
end $$;

create or replace function public.save_company_customer_email_settings(p_company uuid,p_settings jsonb)
returns timestamptz language plpgsql security definer set search_path='' set row_security=off as $$
declare saved_at timestamptz;previous_settings jsonb;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  perform public.validate_company_customer_email_settings(p_settings);
  select s.settings into previous_settings from public.company_customer_email_settings s where s.company_id=p_company;
  insert into public.company_customer_email_revisions(company_id,settings,created_by)
  values(p_company,coalesce(previous_settings,public.default_company_customer_email_settings()),auth.uid());
  insert into public.company_customer_email_settings(company_id,settings,updated_by)
  values(p_company,p_settings,auth.uid())
  on conflict(company_id) do update set settings=excluded.settings,updated_at=now(),updated_by=auth.uid()
  returning updated_at into saved_at;
  delete from public.company_customer_email_revisions r
  where r.company_id=p_company and r.revision_id not in (
    select recent.revision_id from public.company_customer_email_revisions recent
    where recent.company_id=p_company order by recent.revision_seq desc limit 10
  );
  return saved_at;
end $$;

create or replace function public.get_company_customer_email_revisions(p_company uuid)
returns table(revision_id uuid,created_at timestamptz,created_by uuid,settings jsonb)
language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  return query select r.revision_id,r.created_at,r.created_by,r.settings
    from public.company_customer_email_revisions r where r.company_id=p_company
    order by r.revision_seq desc limit 10;
end $$;

create or replace function public.restore_company_customer_email_revision(p_company uuid,p_revision uuid)
returns timestamptz language plpgsql security definer set search_path='' set row_security=off as $$
declare previous_settings jsonb;saved_at timestamptz;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  select r.settings into previous_settings from public.company_customer_email_revisions r
    where r.company_id=p_company and r.revision_id=p_revision;
  if previous_settings is null then raise exception 'Email template revision unavailable' using errcode='22023';end if;
  saved_at:=public.save_company_customer_email_settings(p_company,previous_settings);
  return saved_at;
end $$;

create or replace function public.get_company_customer_email_template(p_company uuid,p_template text,p_language text default 'es',p_user uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare settings jsonb;company_name text;
begin
  if p_template not in('quote_approval','invoice_due') or p_language not in('es','en') then raise exception 'Invalid email template' using errcode='22023';end if;
  if coalesce(auth.role(),'')<>'service_role' and not coalesce(p_user=auth.uid() and (public.is_platform_admin() or public.has_company_role(p_company,array['admin'])),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  select c.name into company_name from public.companies c where c.id=p_company;
  if company_name is null then raise exception 'Company unavailable' using errcode='22023';end if;
  select s.settings into settings from public.company_customer_email_settings s where s.company_id=p_company;
  settings:=coalesce(settings,public.default_company_customer_email_settings());
  return jsonb_build_object('company_name',company_name,'brand',settings->'brand','template',settings->'templates'->p_template->p_language);
end $$;

create or replace function public.get_quote_approval_audit(p_company uuid,p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare link_items jsonb; response_item jsonb; response_items jsonb; current_status text; current_version integer;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  select coalesce(jsonb_agg(jsonb_build_object('issued_at',issued_at,'expires_at',expires_at,'revoked_at',revoked_at,'resolved_at',resolved_at,
    'email_sent_at',email_sent_at,'company_notified_at',company_notified_at) order by issued_at desc),'[]'::jsonb)
    into link_items from public.quote_approval_links where company_id=p_company and quote_id=p_quote;
  select q.status,q.version into current_status,current_version from public.quotes q where company_id=p_company and id=p_quote;
  select to_jsonb(r) into response_item from public.quote_approval_responses r
    where company_id=p_company and quote_id=p_quote order by responded_at desc limit 1;
  select coalesce(jsonb_agg(to_jsonb(r) order by responded_at desc),'[]'::jsonb) into response_items
    from public.quote_approval_responses r where company_id=p_company and quote_id=p_quote;
  return jsonb_build_object('links',link_items,'response',response_item,'responses',response_items,'quote_status',current_status,'quote_version',current_version);
end $$;

create or replace function public.get_quote_approval_notification_payload(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare link_row public.quote_approval_links; response_row public.quote_approval_responses; quote_row public.quotes; admins text[];
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into link_row from public.quote_approval_links where token_hash=p_token_hash and resolved_at is not null;
  if not found then return null; end if;
  perform public.assert_company_module_enabled(link_row.company_id,'billing');
  select * into response_row from public.quote_approval_responses where link_id=link_row.id;
  select * into quote_row from public.quotes where company_id=link_row.company_id and id=link_row.quote_id;
  if not found then return null; end if;
  select coalesce(array_agg(distinct u.email order by u.email),array[]::text[]) into admins
    from public.company_members m join auth.users u on u.id=m.user_id
    where m.company_id=link_row.company_id and m.role='admin' and m.is_active and u.email is not null;
  return jsonb_build_object('link_id',link_row.id,'response_id',response_row.id,'quote_id',quote_row.id,'quote_number',quote_row.number,
    'company_id',link_row.company_id,'company_name',coalesce((select c.name from public.companies c where c.id=link_row.company_id),''),
    'recipient_emails',admins,'decision',response_row.decision,'already_notified',link_row.company_notified_at is not null,'customer_name',response_row.declared_name,
    'customer_email',response_row.declared_email,'responded_at',response_row.responded_at);
end $$;

revoke all on function public.get_company_customer_email_settings(uuid),
  public.save_company_customer_email_settings(uuid,jsonb),
  public.get_company_customer_email_revisions(uuid),
  public.restore_company_customer_email_revision(uuid,uuid),
  public.get_company_customer_email_template(uuid,text,text,uuid),
  public.get_quote_approval_audit(uuid,uuid),
  public.get_quote_approval_notification_payload(text) from public,anon;
grant execute on function public.get_company_customer_email_settings(uuid),
  public.save_company_customer_email_settings(uuid,jsonb),
  public.get_company_customer_email_revisions(uuid),
  public.restore_company_customer_email_revision(uuid,uuid),
  public.get_company_customer_email_template(uuid,text,text,uuid),
  public.get_quote_approval_audit(uuid,uuid) to authenticated,service_role;
grant execute on function public.get_quote_approval_notification_payload(text) to service_role;

-- If a prior attempt renamed legacy functions before failing, leave those copies
-- inaccessible. The current RPCs above no longer depend on them.
do $$ declare item text;
begin
  foreach item in array array[
    'public.get_company_customer_email_settings_unchecked(uuid)',
    'public.save_company_customer_email_settings_unchecked(uuid,jsonb)',
    'public.get_company_customer_email_revisions_unchecked(uuid)',
    'public.restore_company_customer_email_revision_unchecked(uuid,uuid)',
    'public.get_company_customer_email_template_unchecked(uuid,text,text,uuid)',
    'public.get_quote_approval_audit_unchecked(uuid,uuid)',
    'public.get_quote_approval_notification_payload_unchecked(text)'
  ] loop
    if pg_catalog.to_regprocedure(item) is not null then
      execute pg_catalog.format('revoke all on function %s from public,anon,authenticated,service_role',pg_catalog.to_regprocedure(item));
    end if;
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
