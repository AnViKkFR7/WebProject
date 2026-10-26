-- After BILLING_CHAPTER_TEMPLATES.sql. Manual payments and append-only document history.
begin;
create table if not exists public.billing_payment_entries(
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,request_id uuid not null,
  entry_type text not null check(entry_type in ('payment','reversal')),reversal_of uuid references public.billing_payment_entries(id),
  amount numeric(14,2) not null check(amount>0 and amount<=1000000000000),paid_on date not null,
  method text not null default '',reference text not null default '',reason text not null default '',
  created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
  unique(company_id,request_id),check((entry_type='payment' and reversal_of is null) or (entry_type='reversal' and reversal_of is not null))
);
create unique index if not exists billing_payment_one_reversal on public.billing_payment_entries(reversal_of) where entry_type='reversal';
create index if not exists billing_payment_invoice_created on public.billing_payment_entries(company_id,invoice_id,created_at desc);
create table if not exists public.billing_document_events(
  id bigint generated always as identity primary key,company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check(kind in ('invoice','quote')),record_id uuid not null,action text not null,version integer not null,
  snapshot jsonb not null,changes jsonb not null default '{}'::jsonb,actor_id uuid references auth.users(id),actor_label text not null default '',created_at timestamptz not null default now()
);
create index if not exists billing_document_events_record on public.billing_document_events(company_id,kind,record_id,id desc);
alter table public.billing_payment_entries enable row level security;alter table public.billing_document_events enable row level security;
revoke all on public.billing_payment_entries,public.billing_document_events from public,anon,authenticated;
grant select on public.billing_payment_entries,public.billing_document_events to authenticated;
create policy billing_payments_read on public.billing_payment_entries for select to authenticated using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor','viewer']));
create policy billing_history_read on public.billing_document_events for select to authenticated using(public.is_platform_admin() or public.has_company_role(company_id,array['admin','editor','viewer']));

create or replace function public.billing_document_total(p_document jsonb) returns numeric language sql immutable set search_path='' as $$
  with rows as(select round((line->>'quantity')::numeric*(line->>'price')::numeric*(1-(line->>'discount')::numeric/100),2) base,(line->>'tax')::numeric tax from jsonb_array_elements(p_document->'lines') line),
  sums as(select coalesce(sum(base),0) base,coalesce(sum(round(base*tax/100,2)),0) tax from rows)
  select round(base+tax-round(base*coalesce((p_document->>'withholding')::numeric,0)/100,2),2) from sums
$$;
create or replace function public.billing_actor_label(p_company uuid) returns text language sql stable security definer set search_path='' as $$
  select coalesce(auth.uid()::text,'Sistema')
$$;
create or replace function public.capture_billing_document_event() returns trigger language plpgsql security definer set search_path='' as $$
declare event_action text;event_changes jsonb;
begin
  event_action:=case when tg_op='INSERT' then 'created' when old.document is distinct from new.document then 'document_updated' when old.status is distinct from new.status then 'status_changed' else 'metadata_updated' end;
  event_changes:=case when tg_op='INSERT' then '{}'::jsonb else jsonb_build_object('previous_version',old.version,'document_changed',old.document is distinct from new.document,'status_before',old.status,'status_after',new.status) end;
  insert into public.billing_document_events(company_id,kind,record_id,action,version,snapshot,changes,actor_id,actor_label)
  values(new.company_id,case when tg_table_name='quotes' then 'quote' else 'invoice' end,new.id,event_action,new.version,to_jsonb(new),event_changes,auth.uid(),public.billing_actor_label(new.company_id));return new;
end $$;
drop trigger if exists capture_invoice_history on public.invoices;create trigger capture_invoice_history after insert or update on public.invoices for each row execute function public.capture_billing_document_event();
drop trigger if exists capture_quote_history on public.quotes;create trigger capture_quote_history after insert or update on public.quotes for each row execute function public.capture_billing_document_event();
insert into public.billing_document_events(company_id,kind,record_id,action,version,snapshot,actor_id,actor_label)
select i.company_id,'invoice',i.id,'baseline',i.version,to_jsonb(i),i.created_by,coalesce(i.created_by::text,'Sistema') from public.invoices i where not exists(select 1 from public.billing_document_events e where e.kind='invoice' and e.record_id=i.id);
insert into public.billing_document_events(company_id,kind,record_id,action,version,snapshot,actor_id,actor_label)
select q.company_id,'quote',q.id,'baseline',q.version,to_jsonb(q),q.created_by,coalesce(q.created_by::text,'Sistema') from public.quotes q where not exists(select 1 from public.billing_document_events e where e.kind='quote' and e.record_id=q.id);

create or replace function public.get_invoice_financials(p_company uuid)
returns table(invoice_id uuid,total numeric,paid numeric,balance numeric,payment_state text,due_date date) language plpgsql security definer set search_path='' as $$
begin
  if not(public.is_platform_admin() or public.has_company_role(p_company,array['admin','editor','viewer'])) then raise exception 'Forbidden' using errcode='42501';end if;
  return query select i.id,t.total,coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)::numeric,
    greatest(t.total-coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0),0)::numeric,
    case when coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)<=0 then case when i.status='issued' and nullif(i.document->>'dueDate','')::date<current_date then 'overdue' else 'outstanding' end
      when coalesce(sum(case when e.entry_type='payment' then e.amount else -e.amount end),0)<t.total then 'partial' else 'paid' end,
    nullif(i.document->>'dueDate','')::date
  from public.invoices i cross join lateral(select public.billing_document_total(i.document) total)t left join public.billing_payment_entries e on e.invoice_id=i.id and e.company_id=i.company_id
  where i.company_id=p_company and i.status in('issued','paid') group by i.id,t.total;
end $$;
create or replace function public.register_invoice_payment(p_company uuid,p_invoice uuid,p_version integer,p_request uuid,p_amount numeric,p_paid_on date,p_method text,p_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source public.invoices;entry public.billing_payment_entries;total numeric;paid numeric;next_status text;
begin
  perform public.assert_billing_access(p_company);select * into entry from public.billing_payment_entries where company_id=p_company and request_id=p_request;
  if entry.id is not null then
    select * into source from public.invoices where company_id=p_company and id=entry.invoice_id;
    total:=public.billing_document_total(source.document);select coalesce(sum(case when entry_type='payment' then amount else -amount end),0) into paid from public.billing_payment_entries where invoice_id=source.id;
    return to_jsonb(entry)||jsonb_build_object('invoice_version',source.version,'invoice_status',source.status,'balance',greatest(total-paid,0));
  end if;
  select * into source from public.invoices where company_id=p_company and id=p_invoice for update;
  if source.id is null or source.version is distinct from p_version or source.status not in('issued','paid') then raise exception 'Invoice changed or unavailable' using errcode='40001';end if;
  p_method:=trim(coalesce(p_method,''));p_reference:=trim(coalesce(p_reference,''));
  if p_request is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_paid_on is null or length(p_method)>100 or length(p_reference)>300 then raise exception 'Invalid payment' using errcode='22023';end if;
  total:=public.billing_document_total(source.document);select coalesce(sum(case when entry_type='payment' then amount else -amount end),0) into paid from public.billing_payment_entries where invoice_id=source.id;
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
  perform public.assert_billing_access(p_company);select * into entry from public.billing_payment_entries where company_id=p_company and request_id=p_request;
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
create or replace function public.restore_billing_draft_version(p_company uuid,p_kind text,p_record uuid,p_event bigint,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare event public.billing_document_events;result jsonb;
begin
  perform public.assert_billing_access(p_company);select * into event from public.billing_document_events where id=p_event and company_id=p_company and kind=p_kind and record_id=p_record;
  if event.id is null or event.snapshot->>'status' is distinct from 'draft' or event.snapshot->'document' is null then raise exception 'Draft version unavailable' using errcode='40001';end if;
  if p_kind='invoice' then result:=to_jsonb(public.save_invoice(p_company,event.snapshot->'document','draft',p_record,p_version));
  elsif p_kind='quote' then result:=to_jsonb(public.save_quote(p_company,event.snapshot->'document','draft',p_record,p_version));else raise exception 'Invalid kind' using errcode='22023';end if;
  return result;
end $$;
revoke all on function public.billing_document_total(jsonb),public.billing_actor_label(uuid),public.capture_billing_document_event(),public.get_invoice_financials(uuid),public.register_invoice_payment(uuid,uuid,integer,uuid,numeric,date,text,text),public.reverse_invoice_payment(uuid,uuid,uuid,text),public.restore_billing_draft_version(uuid,text,uuid,bigint,integer) from public,anon;
grant execute on function public.get_invoice_financials(uuid) to authenticated;
grant execute on function public.register_invoice_payment(uuid,uuid,integer,uuid,numeric,date,text,text),public.reverse_invoice_payment(uuid,uuid,uuid,text),public.restore_billing_draft_version(uuid,text,uuid,bigint,integer) to authenticated;
notify pgrst,'reload schema';commit;
