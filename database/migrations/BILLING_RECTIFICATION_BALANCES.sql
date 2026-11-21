-- Apply after COMPANY_MODULES_RPC_COMPLETION and BILLING_DUE_REMINDERS.
begin;
create index if not exists invoices_company_rectifies_idx on public.invoices(company_id,rectifies_invoice_id);
create or replace function public.invoice_family_financials(p_company uuid)
returns table(invoice_id uuid,root_id uuid,current_id uuid,total numeric,paid numeric)
language sql stable security definer set search_path='' as $$
 with recursive family as (
  select i.id,i.id root_id,i.created_at,i.number,i.rectification_method,i.document
  from public.invoices i where i.company_id=p_company and i.rectifies_invoice_id is null and i.status in('issued','paid')
  union all
  select c.id,f.root_id,c.created_at,c.number,c.rectification_method,c.document
  from public.invoices c join family f on c.rectifies_invoice_id=f.id
  where c.company_id=p_company and c.status in('issued','paid')
 ), ordered as (
  select f.*,row_number() over(partition by f.root_id order by f.created_at,
    case when f.rectification_method is null then 0 else coalesce(nullif(substring(f.number from '[0-9]+$'),''),'0')::numeric end,f.id) n
  from family f
 ), bounds as (
  select o.root_id,max(o.n) last_n,coalesce(max(o.n) filter(where o.rectification_method='substitution'),1) base_n
  from ordered o group by o.root_id
 ), totals as (
  select o.root_id,sum(public.billing_document_total(o.document)) filter(where o.n>=b.base_n) total
  from ordered o join bounds b on b.root_id=o.root_id group by o.root_id
 ), payments as (
  select o.root_id,sum(case when e.entry_type='payment' then e.amount else -e.amount end) paid
  from ordered o join public.billing_payment_entries e on e.invoice_id=o.id and e.company_id=p_company group by o.root_id
 )
 select o.id,o.root_id,c.id,t.total,coalesce(p.paid,0)::numeric
 from ordered o join bounds b on b.root_id=o.root_id join ordered c on c.root_id=b.root_id and c.n=b.last_n
 join totals t on t.root_id=o.root_id left join payments p on p.root_id=o.root_id
$$;
revoke all on function public.invoice_family_financials(uuid) from public,anon,authenticated;
grant execute on function public.invoice_family_financials(uuid) to service_role;

create or replace function public.lock_invoice_family(p_company uuid,p_invoice uuid)
returns void language plpgsql security definer set search_path='' as $$
declare root uuid;
begin
 select f.root_id into root from public.invoice_family_financials(p_company) f where f.invoice_id=p_invoice;
 if root is null then raise exception 'Invoice unavailable' using errcode='40001'; end if;
 perform 1 from public.invoices where company_id=p_company and id=root for update;
end $$;
revoke all on function public.lock_invoice_family(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.get_invoice_financials(p_company uuid)
returns table(invoice_id uuid,total numeric,paid numeric,balance numeric,payment_state text,due_date date)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_company is null or not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor','viewer']),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform public.assert_company_module_enabled(p_company,'billing');
 return query select i.id,
   case when i.id=f.current_id then f.total else public.billing_document_total(i.document) end,
   case when i.id=f.current_id then f.paid else 0 end::numeric,
   case when i.id=f.current_id then greatest(f.total-f.paid,0) else 0 end::numeric,
   case when i.id<>f.current_id then 'rectified' when f.total-f.paid<0 then 'credit' when f.total-f.paid=0 then 'paid'
     when f.paid>0 then 'partial' when nullif(i.document->>'dueDate','')::date<current_date then 'overdue' else 'outstanding' end,
   nullif(i.document->>'dueDate','')::date
 from public.invoice_family_financials(p_company) f join public.invoices i on i.id=f.invoice_id and i.company_id=p_company;
end $$;


create or replace function public.rectify_invoice(p_company uuid,p_original uuid,p_document jsonb,
  p_method text,p_cause text,p_note text,p_request uuid)
returns public.invoices language plpgsql security definer set search_path=pg_catalog,public as $$
declare original public.invoices;result public.invoices;seq bigint;prefix text;line jsonb;
begin
  perform public.assert_billing_access(p_company);
  perform public.lock_invoice_family(p_company,p_original);
  if p_method not in('difference','substitution') or p_method is null
    or p_cause not in('required_data','incorrect_tax','article_80','other') or p_cause is null
    or nullif(trim(p_note),'') is null or length(p_note)>2000 or p_request is null then raise exception 'Invalid rectification details' using errcode='22023';end if;
  select * into result from public.invoices where company_id=p_company and rectification_request_id=p_request;
  if found then return result;end if;
  select * into original from public.invoices where company_id=p_company and id=p_original for update;
  if not found or original.status not in('issued','paid') then raise exception 'Original invoice is not eligible for rectification' using errcode='22023';end if;
  select * into result from public.invoices where company_id=p_company and rectification_request_id=p_request;
  if found then return result;end if;
  perform public.validate_billing_document(p_document);
  if p_document?'rectification' then raise exception 'Rectification metadata is server controlled' using errcode='22023';end if;
  if p_method='difference' then
    for line in select value from jsonb_array_elements(p_document->'lines') loop
      if line?'sign' and line->>'sign' not in('1','-1') then raise exception 'Invalid correction sign' using errcode='22023';end if;
    end loop;
  else
    for line in select value from jsonb_array_elements(p_document->'lines') loop
      if line?'sign' then raise exception 'Replacement lines cannot carry a sign' using errcode='22023';end if;
    end loop;
  end if;
  insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
  update public.invoice_settings set next_rectification_number=next_rectification_number+1
    where company_id=p_company
    returning next_rectification_number-1,coalesce(nullif(profile->>'rectificationPrefix',''),'FR') into seq,prefix;
  insert into public.invoices(company_id,number,status,document,rectifies_invoice_id,rectification_method,rectification_cause,rectification_request_id)
  values(p_company,prefix||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),'issued',
    jsonb_set(p_document,'{rectification}',jsonb_build_object('originalId',original.id,'originalNumber',original.number,
      'method',p_method,'cause',p_cause,'note',trim(p_note),'originalTotal',public.billing_document_total(original.document))),
    original.id,p_method,p_cause,p_request) returning * into result;
  return result;
end $$;

create or replace function public.register_invoice_payment(p_company uuid,p_invoice uuid,p_version integer,p_request uuid,p_amount numeric,p_paid_on date,p_method text,p_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source public.invoices;entry public.billing_payment_entries;total numeric;paid numeric;next_status text; family record;
begin
  perform public.assert_billing_access(p_company);perform public.lock_invoice_family(p_company,p_invoice);select * into entry from public.billing_payment_entries where company_id=p_company and request_id=p_request;
  if entry.id is not null then
    if entry.invoice_id<>p_invoice then raise exception 'Payment request mismatch' using errcode='40001'; end if;
    select * into source from public.invoices where company_id=p_company and id=entry.invoice_id;
    select * into family from public.invoice_family_financials(p_company) f where f.invoice_id=source.id;total:=family.total;paid:=family.paid;
    return to_jsonb(entry)||jsonb_build_object('invoice_version',source.version,'invoice_status',source.status,'balance',greatest(total-paid,0));
  end if;
  select * into source from public.invoices where company_id=p_company and id=p_invoice for update;
  if source.id is null or source.version is distinct from p_version or source.status not in('issued','paid') then raise exception 'Invoice changed or unavailable' using errcode='40001';end if;
  p_method:=trim(coalesce(p_method,''));p_reference:=trim(coalesce(p_reference,''));
  if p_request is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_paid_on is null or length(p_method)>100 or length(p_reference)>300 then raise exception 'Invalid payment' using errcode='22023';end if;
  select * into family from public.invoice_family_financials(p_company) f where f.invoice_id=source.id;total:=family.total;paid:=family.paid;
  if family.current_id<>source.id then raise exception 'Use the latest rectifying invoice' using errcode='40001';end if;
  if p_amount>total-paid then raise exception 'Payment exceeds balance' using errcode='22023';end if;
  insert into public.billing_payment_entries(company_id,invoice_id,request_id,entry_type,amount,paid_on,method,reference,created_by)
    values(p_company,p_invoice,p_request,'payment',p_amount,p_paid_on,p_method,p_reference,auth.uid()) returning * into entry;
  next_status:=case when paid+p_amount>=total then 'paid' else 'issued' end;
  update public.invoices set status=next_status,version=version+1,updated_at=now(),last_edited_by=auth.uid() where id=source.id;
  insert into public.billing_document_events(company_id,kind,record_id,action,version,snapshot,changes,actor_id,actor_label) values(p_company,'invoice',source.id,'payment_registered',source.version+1,jsonb_build_object('payment',to_jsonb(entry),'balance',total-paid-p_amount),jsonb_build_object('balance_before',total-paid,'balance_after',total-paid-p_amount),auth.uid(),public.billing_actor_label(p_company));
  return to_jsonb(entry)||jsonb_build_object('invoice_version',source.version+1,'invoice_status',next_status,'balance',total-paid-p_amount);
end $$;

create or replace function public.reverse_invoice_payment(p_company uuid,p_payment uuid,p_request uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare original public.billing_payment_entries;entry public.billing_payment_entries;source public.invoices;
begin
  perform public.assert_billing_access(p_company);
  perform public.lock_invoice_family(p_company,(select invoice_id from public.billing_payment_entries where id=p_payment and company_id=p_company));select * into entry from public.billing_payment_entries where company_id=p_company and request_id=p_request;
  if entry.id is not null then
    select * into source from public.invoices where company_id=p_company and id=entry.invoice_id;
    return to_jsonb(entry)||jsonb_build_object('invoice_version',source.version,'invoice_status',source.status);
  end if;
  select * into original from public.billing_payment_entries where company_id=p_company and id=p_payment and entry_type='payment' for update;
  if original.id is null or exists(select 1 from public.billing_payment_entries where reversal_of=original.id) then raise exception 'Payment changed or unavailable' using errcode='40001';end if;
  p_reason:=trim(coalesce(p_reason,''));if p_request is null or length(p_reason) not between 1 and 1000 then raise exception 'Reversal reason required' using errcode='22023';end if;
  select * into source from public.invoices where company_id=p_company and id=original.invoice_id for update;
  insert into public.billing_payment_entries(company_id,invoice_id,request_id,entry_type,reversal_of,amount,paid_on,method,reference,reason,created_by)
    values(p_company,original.invoice_id,p_request,'reversal',original.id,original.amount,current_date,original.method,original.reference,p_reason,auth.uid()) returning * into entry;
  update public.invoices set status='issued',version=version+1,updated_at=now(),last_edited_by=auth.uid() where id=source.id;
  insert into public.billing_document_events(company_id,kind,record_id,action,version,snapshot,changes,actor_id,actor_label) values(p_company,'invoice',source.id,'payment_reversed',source.version+1,jsonb_build_object('reversal',to_jsonb(entry)),jsonb_build_object('reason',p_reason,'payment_id',original.id),auth.uid(),public.billing_actor_label(p_company));
  return to_jsonb(entry)||jsonb_build_object('invoice_version',source.version+1,'invoice_status','issued');
end $$;

create or replace function public.enqueue_billing_due_reminders(p_as_of date default ((now() at time zone 'Europe/Madrid')::date))
returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
  insert into public.billing_due_reminder_queue(company_id,invoice_id,due_date,offset_days,scheduled_for)
  select i.company_id,i.id,public.billing_safe_document_date(i.document->>'dueDate'),d.offset_day,
    ((p_as_of + s.local_send_time) at time zone s.timezone)
  from public.billing_due_reminder_settings s
  join public.invoices i on i.company_id=s.company_id and i.status in('issued','paid')
  cross join lateral unnest(s.offsets_days) d(offset_day)
  left join public.billing_invoice_reminder_preferences pref on pref.company_id=i.company_id and pref.invoice_id=i.id
  join lateral(select f.total,f.paid from public.invoice_family_financials(i.company_id) f where f.invoice_id=i.id and f.current_id=i.id) totals on true
  where s.enabled and public.is_company_module_enabled(i.company_id,'billing')
    and coalesce(pref.suppressed,false)=false
    and public.billing_safe_document_date(i.document->>'dueDate') is not null
    and public.billing_safe_document_date(i.document->>'dueDate') - d.offset_day = p_as_of
    and totals.total-totals.paid>0
  on conflict(company_id,invoice_id,due_date,offset_days) do update set status='queued',scheduled_for=excluded.scheduled_for,
    available_at=now(),attempt_count=0,locked_at=null,last_error_code=null,updated_at=now()
    where public.billing_due_reminder_queue.status='skipped'
      and public.billing_due_reminder_queue.last_error_code in('schedule_changed','reminders_disabled','module_disabled','suppressed');
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

create or replace function public.claim_billing_due_reminder_batch(p_limit integer default 25)
returns table(queue_id uuid,job_company_id uuid,job_invoice_id uuid,job_due_date date,job_offset_days integer,job_attempt_count integer,delivery_generation integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid batch size' using errcode='22023';end if;
  update public.billing_due_reminder_queue q set status='dead',locked_at=null,last_error_code='sent_marker_failed',updated_at=now()
    where q.status='sending' and q.locked_at<now()-interval '20 hours';
  update public.billing_due_reminder_queue q set status='dead',locked_at=null,last_error_code='unexpected_failure',updated_at=now()
    where q.status='sending' and q.locked_at<now()-interval '10 minutes' and q.attempt_count>=8;
  update public.billing_due_reminder_queue q set status='skipped',locked_at=null,
    last_error_code=case when not public.is_company_module_enabled(q.company_id,'billing') then 'module_disabled'
      when not coalesce(s.enabled,false) then 'reminders_disabled'
      when coalesce(pref.suppressed,false) then 'suppressed'
      when i.id is null or i.status not in('issued','paid') then 'invoice_unavailable'
      when coalesce(t.total,0)-coalesce(pay.paid,0)<=0 then 'balance_settled' else 'invoice_unavailable' end,
    updated_at=now()
  from public.invoices i
  left join public.billing_due_reminder_settings s on s.company_id=i.company_id
  left join public.billing_invoice_reminder_preferences pref on pref.company_id=i.company_id and pref.invoice_id=i.id
  left join lateral(select case when f.current_id=i.id then f.total else 0 end total from public.invoice_family_financials(i.company_id) f where f.invoice_id=i.id)t on true
  left join lateral(select f.paid from public.invoice_family_financials(i.company_id) f where f.invoice_id=i.id) pay on true
  where q.invoice_id=i.id and q.company_id=i.company_id and q.status in('queued','sending')
    and (not public.is_company_module_enabled(q.company_id,'billing') or not coalesce(s.enabled,false) or coalesce(pref.suppressed,false) or i.status not in('issued','paid') or coalesce(t.total,0)-coalesce(pay.paid,0)<=0);
  return query
  with picked as(
    select q.id from public.billing_due_reminder_queue q
    join public.invoices i on i.id=q.invoice_id and i.company_id=q.company_id and i.status in('issued','paid')
    join public.billing_due_reminder_settings s on s.company_id=q.company_id and s.enabled
    where q.attempt_count<8 and q.available_at<=now() and q.scheduled_for<=now()
      and public.is_company_module_enabled(q.company_id,'billing')
      and not coalesce((select pref.suppressed from public.billing_invoice_reminder_preferences pref where pref.company_id=q.company_id and pref.invoice_id=q.invoice_id),false)
      and exists(select 1 from public.invoice_family_financials(i.company_id) f where f.invoice_id=i.id and f.current_id=i.id and f.total-f.paid>0)
      and (q.status='queued' or (q.status='sending' and q.locked_at<now()-interval '10 minutes'))
    order by q.available_at,q.scheduled_for,q.created_at for update of q skip locked limit p_limit
  )
  update public.billing_due_reminder_queue q set status='sending',attempt_count=q.attempt_count+1,locked_at=now(),updated_at=now()
  from picked where q.id=picked.id
  returning q.id,q.company_id,q.invoice_id,q.due_date,q.offset_days,q.attempt_count,q.delivery_generation;
end $$;

create or replace function public.get_billing_due_reminder_payload(p_queue uuid)
returns table(company_id uuid,invoice_id uuid,recipient_email text,invoice_number text,due_date date,balance numeric)
language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.billing_due_reminder_queue;i public.invoices;reminder_enabled boolean;is_suppressed boolean;paid numeric;total numeric;
begin
  select * into q from public.billing_due_reminder_queue where id=p_queue and status='sending' for update;
  if not found then return;end if;
  select inv.* into i from public.invoices inv where inv.id=q.invoice_id and inv.company_id=q.company_id;
  select coalesce((select s.enabled from public.billing_due_reminder_settings s where s.company_id=q.company_id),false) into reminder_enabled;
  select coalesce((select pref.suppressed from public.billing_invoice_reminder_preferences pref where pref.company_id=q.company_id and pref.invoice_id=q.invoice_id),false) into is_suppressed;
  if not public.is_company_module_enabled(q.company_id,'billing') or not reminder_enabled or is_suppressed or i.id is null or i.status not in('issued','paid') then
    update public.billing_due_reminder_queue set status='skipped',locked_at=null,last_error_code=case
      when not public.is_company_module_enabled(q.company_id,'billing') then 'module_disabled'
      when not reminder_enabled then 'reminders_disabled'
      when is_suppressed then 'suppressed' else 'invoice_unavailable' end,updated_at=now() where id=q.id;
    return;
  end if;
  select case when f.current_id=i.id then f.total else 0 end,f.paid into total,paid from public.invoice_family_financials(q.company_id) f where f.invoice_id=q.invoice_id;
  if coalesce(total-paid,0)<=0 then
    update public.billing_due_reminder_queue set status='skipped',locked_at=null,last_error_code='balance_settled',updated_at=now() where id=q.id;
    return;
  end if;
  return query select i.company_id,i.id,nullif(trim(i.document#>>'{customer,email}'),''),i.number,
    public.billing_safe_document_date(i.document->>'dueDate'),greatest(total-paid,0)::numeric;
end $$;

create or replace function public.set_invoice_due_reminders(p_company uuid,p_invoice uuid,p_suppressed boolean)
returns public.billing_invoice_reminder_preferences language plpgsql security definer set search_path='' as $$
declare result public.billing_invoice_reminder_preferences;
begin
  perform public.assert_billing_access(p_company);
  if not public.is_company_module_enabled(p_company,'billing') then raise exception 'Company module is disabled' using errcode='42501';end if;
  if not exists(select 1 from public.invoices where company_id=p_company and id=p_invoice and status in('issued','paid')) then
    raise exception 'Invoice unavailable' using errcode='40001';
  end if;
  insert into public.billing_invoice_reminder_preferences(company_id,invoice_id,suppressed,updated_by)
    values(p_company,p_invoice,p_suppressed,auth.uid())
  on conflict(company_id,invoice_id) do update set suppressed=excluded.suppressed,updated_at=now(),updated_by=auth.uid()
  returning * into result;
  if p_suppressed then
    update public.billing_due_reminder_queue set status='skipped',locked_at=null,last_error_code='suppressed',updated_at=now()
      where company_id=p_company and invoice_id=p_invoice and status in('queued','sending');
  end if;
  return result;
end $$;

notify pgrst,'reload schema';

commit;
