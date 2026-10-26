-- After BILLING_PAYMENTS_HISTORY.sql. Emitted invoice content is immutable;
-- payment RPCs remain responsible for financial status changes.
begin;
create or replace function public.save_invoice(p_company uuid,p_document jsonb,p_status text,
  p_id uuid default null,p_version integer default null)
returns public.invoices language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.invoices;seq bigint;prefix text;
begin
  perform public.assert_billing_access(p_company);
  perform public.validate_billing_document(p_document);
  if p_id is null then
    if p_status not in('draft','issued') or p_status is null then raise exception 'Invalid initial invoice status';end if;
    insert into public.invoice_settings(company_id) values(p_company) on conflict do nothing;
    update public.invoice_settings set next_number=next_number+1 where company_id=p_company
      returning next_number-1,coalesce(nullif(profile->>'prefix',''),'F') into seq,prefix;
    insert into public.invoices(company_id,number,status,document)
      values(p_company,prefix||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),p_status,p_document) returning * into result;
  else
    if p_version is null then raise exception 'Missing document version' using errcode='40001';end if;
    select * into result from public.invoices where id=p_id and company_id=p_company for update;
    if not found or result.version is distinct from p_version or result.status='cancelled' then
      raise exception 'Invoice changed or cancelled; reload' using errcode='40001';
    end if;
    if result.status<>'draft' then
      raise exception 'Issued invoices are immutable; use a rectifying invoice' using errcode='55000';
    end if;
    if p_status not in('draft','issued','cancelled') or p_status is null then raise exception 'Invalid status';end if;
    update public.invoices set document=p_document,status=p_status,version=version+1,
      updated_at=now(),last_edited_by=auth.uid()
      where id=p_id and company_id=p_company and version=p_version and status='draft'
      returning * into result;
    if not found then raise exception 'Invoice changed; reload' using errcode='40001';end if;
  end if;
  return result;
end $$;
revoke all on function public.save_invoice(uuid,jsonb,text,uuid,integer) from public,anon;
grant execute on function public.save_invoice(uuid,jsonb,text,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
