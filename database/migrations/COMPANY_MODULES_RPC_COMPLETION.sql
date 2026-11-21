-- Apply after all billing/CRM/planning migrations, COMPANY_MODULES_SCOPE_FIX and audit deliveries 1-5.

begin;

create or replace function public.assert_billing_access(p_company uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or p_company is null or not coalesce(
    public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'billing');
end $$;

create or replace function public.assert_crm_privacy_admin(p_company uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if auth.uid() is null or p_company is null or not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  perform public.assert_company_module_enabled(p_company,'crm');
end $$;

create or replace function public.get_invoice_financials(p_company uuid)
returns table(invoice_id uuid,total numeric,paid numeric,balance numeric,payment_state text,due_date date)
language plpgsql security definer set search_path='' as $$
begin
  if not(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor','viewer'])) then raise exception 'Forbidden' using errcode='42501';end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  return query select i.id,t.total,coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)::numeric,
    greatest(t.total-coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0),0)::numeric,
    case when t.total<0 then 'credit'
      when coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)<=0 then case when i.status='issued' and nullif(i.document->>'dueDate','')::date<current_date then 'overdue' else 'outstanding' end
      when coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)<t.total then 'partial' else 'paid' end,
    nullif(i.document->>'dueDate','')::date
  from public.invoices i cross join lateral(select public.billing_document_total(i.document) total)t left join public.billing_payment_entries e on e.invoice_id=i.id and e.company_id=i.company_id
  where i.company_id=p_company and i.status in('issued','paid') group by i.id,t.total;
end $$;

create or replace function public.list_billing_due_reminder_failures(p_company uuid)
returns table(company_id uuid,id uuid,invoice_id uuid,invoice_number text,customer_name text,due_date date,offset_days integer,last_error_code text,attempt_count integer,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_company_role(p_company,array['admin','editor','viewer']) then raise exception 'Forbidden' using errcode='42501';end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  return query select q.company_id,q.id,q.invoice_id,i.number,coalesce(i.document#>>'{customer,name}',''),q.due_date,q.offset_days,q.last_error_code,q.attempt_count,q.updated_at
    from public.billing_due_reminder_queue q join public.invoices i on i.id=q.invoice_id and i.company_id=q.company_id
    where q.company_id=p_company and q.status='dead' order by q.updated_at desc limit 100;
end $$;

create or replace function public.retry_billing_due_reminder(p_company uuid,p_queue uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not public.has_company_role(p_company,array['admin','editor']) then raise exception 'Forbidden' using errcode='42501';end if;
  perform public.assert_company_module_enabled(p_company,'billing');
  update public.billing_due_reminder_queue set status='queued',attempt_count=0,delivery_generation=delivery_generation+1,available_at=now(),locked_at=null,last_error_code=null,updated_at=now()
    where id=p_queue and company_id=p_company and status='dead' and last_error_code is distinct from 'sent_marker_failed' and provider_message_id is null;
  return found;
end $$;

create or replace function public.list_planning_email_failures(p_company uuid)
returns table(id uuid,task_id uuid,task_title text,occurrence_at timestamptz,last_error_code text,attempt_count integer,updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.has_company_role(p_company,array['admin','editor','viewer']) then raise exception 'Forbidden' using errcode='42501';end if;
  perform public.assert_company_module_enabled(p_company,'planning');
  return query select q.id,q.task_id,t.title,q.occurrence_at,q.last_error_code,q.attempt_count,q.updated_at
    from public.planning_email_queue q join public.planning_task t on t.id=q.task_id and t.company_id=q.company_id
    where q.company_id=p_company and q.status='dead' order by q.updated_at desc limit 100;
end $$;

create or replace function public.retry_planning_email(p_company uuid,p_queue uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.has_company_role(p_company,array['admin','editor']) then raise exception 'Forbidden' using errcode='42501';end if;
  perform public.assert_company_module_enabled(p_company,'planning');
  update public.planning_email_queue set status='queued',attempt_count=0,delivery_generation=delivery_generation+1,available_at=now(),locked_at=null,last_error_code=null,updated_at=now()
    where id=p_queue and company_id=p_company and status='dead' and last_error_code is distinct from 'sent_marker_failed' and provider_message_id is null;
  return found;
end $$;

create or replace function public.export_crm_contact(p_company uuid,p_contact uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare contact_row public.crm_contacts; result jsonb;
begin
  perform public.assert_crm_privacy_admin(p_company);
  select * into contact_row from public.crm_contacts where company_id=p_company and id=p_contact;
  if not found then raise exception 'Contact not found' using errcode='P0002'; end if;
  select pg_catalog.jsonb_build_object(
    'schema_version',2,'exported_at',pg_catalog.now(),'contact',pg_catalog.to_jsonb(contact_row),
    'requests',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.created_at,l.id) from public.lead l where l.company_id=p_company and l.crm_contact_id=p_contact),'[]'::jsonb),
    'activities',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) order by a.occurred_at,a.id) from public.crm_activities a where a.company_id=p_company and a.contact_id=p_contact),'[]'::jsonb),
    'billing_module_enabled',public.is_company_module_enabled(p_company,'billing'),
    'billing_documents',coalesce((select pg_catalog.jsonb_agg(x.entry order by x.linked_at)
      from (select pg_catalog.jsonb_build_object('kind',l.document_kind,'number',i.number,'status',i.status,'document',i.document,'linked_at',l.linked_at) as entry,l.linked_at
        from public.crm_billing_links l join public.invoices i on l.document_kind='invoice' and i.id=l.document_id and i.company_id=l.company_id
        where l.company_id=p_company and l.contact_id=p_contact and public.is_company_module_enabled(p_company,'billing')
        union all
        select pg_catalog.jsonb_build_object('kind',l.document_kind,'number',q.number,'status',q.status,'document',q.document,'linked_at',l.linked_at),l.linked_at
        from public.crm_billing_links l join public.quotes q on l.document_kind='quote' and q.id=l.document_id and q.company_id=l.company_id
        where l.company_id=p_company and l.contact_id=p_contact and public.is_company_module_enabled(p_company,'billing')) x),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.can_access_planner_object(p_name text,p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare tenant uuid;
begin
  if auth.uid() is null then return false; end if;
  if split_part(p_name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    tenant:=split_part(p_name,'/',1)::uuid;
    if not public.is_company_module_enabled(tenant,'planning') then return false; end if;
    return public.is_platform_admin() or case when p_write then public.has_company_role(tenant,array['admin','editor'])
      else public.is_company_member(tenant) end;
  end if;
  return exists(select 1 from public.planner_legacy_files f where f.path=p_name
    and public.is_company_module_enabled(f.company_id,'planning')
    and (public.is_platform_admin() or case when p_write then public.has_company_role(f.company_id,array['admin','editor'])
      else public.is_company_member(f.company_id) end));
end $$;

-- Existing function ACLs remain unchanged; no unchecked aliases are created.

notify pgrst,'reload schema';

commit;
