-- Brand and editable HTML for customer-facing billing emails.
-- Apply after BILLING_APPEARANCE.sql and before enabling template-aware Edge code.
begin;

create table if not exists public.company_customer_email_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  settings jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.company_customer_email_revisions (
  revision_id uuid primary key default gen_random_uuid(),
  revision_seq bigint generated always as identity unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists company_customer_email_revisions_recent_idx
  on public.company_customer_email_revisions(company_id,revision_seq desc);

alter table public.company_customer_email_settings enable row level security;
alter table public.company_customer_email_revisions enable row level security;
revoke all on public.company_customer_email_settings,public.company_customer_email_revisions from public,anon,authenticated;
grant select,insert,update,delete on public.company_customer_email_settings,public.company_customer_email_revisions to service_role;

create or replace function public.default_company_customer_email_settings()
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object(
    'brand',jsonb_build_object(
      'layout','classic','logo','',
      'palette',jsonb_build_object('id','graphite','accent','#334155','ink','#20252b','muted','#58616d','paper','#ffffff','surface','#f1f3f5')
    ),
    'templates',jsonb_build_object(
      'quote_approval',jsonb_build_object(
        'es',jsonb_build_object('subject','Presupuesto {{quote_number}} · {{company_name}}','preheader','Revisa y responde al presupuesto que te ha enviado {{company_name}}.','html','<p>Hola {{customer_name}},</p><p>{{company_name}} te ha enviado el presupuesto <strong>{{quote_number}}</strong>.</p><p>Revísalo y acepta o rechaza la propuesta desde el siguiente enlace:</p><p><a href="{{approval_url}}">Revisar presupuesto</a></p><p>El enlace caduca el {{expires_at}}.</p>'),
        'en',jsonb_build_object('subject','Quote {{quote_number}} from {{company_name}}','preheader','Review and respond to the quote from {{company_name}}.','html','<p>Hello {{customer_name}},</p><p>{{company_name}} sent you quote <strong>{{quote_number}}</strong>.</p><p>Review it and accept or reject the offer using this link:</p><p><a href="{{approval_url}}">Review quote</a></p><p>This link expires on {{expires_at}}.</p>')
      ),
      'invoice_due',jsonb_build_object(
        'es',jsonb_build_object('subject','Aviso de vencimiento · Factura {{invoice_number}}','preheader','Hay un saldo pendiente de {{balance}} en la factura {{invoice_number}}.','html','<p>Te recordamos que la factura <strong>{{invoice_number}}</strong> venció el <strong>{{due_date}}</strong>.</p><p>Saldo pendiente: <strong>{{balance}}</strong>.</p><p>Si ya has realizado el pago, puedes ignorar este mensaje.</p>'),
        'en',jsonb_build_object('subject','Payment reminder · Invoice {{invoice_number}}','preheader','Invoice {{invoice_number}} has an outstanding balance of {{balance}}.','html','<p>This is a reminder that invoice <strong>{{invoice_number}}</strong> was due on <strong>{{due_date}}</strong>.</p><p>Outstanding balance: <strong>{{balance}}</strong>.</p><p>If you have already paid, please ignore this message.</p>')
      )
    )
  );
$$;

create or replace function public.validate_company_customer_email_settings(p_settings jsonb)
returns void language plpgsql set search_path='' as $$
declare palette jsonb;brand jsonb;templates jsonb;template jsonb;locale_template jsonb;key text;color_key text;locale text;
begin
  if p_settings is null or jsonb_typeof(p_settings)<>'object' or octet_length(p_settings::text)>1800000 then
    raise exception 'Invalid customer email settings' using errcode='22023';
  end if;
  brand:=p_settings->'brand';templates:=p_settings->'templates';
  if jsonb_typeof(brand) is distinct from 'object' or coalesce(brand->>'layout','') not in('classic','bold')
    or jsonb_typeof(brand->'logo') is distinct from 'string' or length(brand->>'logo')>1400000
    or (coalesce(brand->>'logo','')<>'' and brand->>'logo' !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$') then
    raise exception 'Invalid customer email brand' using errcode='22023';
  end if;
  if coalesce(brand->>'logo','')<>'' then
    begin
      if brand->>'logo' like 'data:image/png;base64,%' then
        if substring(decode(split_part(brand->>'logo',',',2),'base64') from 1 for 8)<>decode('89504e470d0a1a0a','hex') then raise exception 'Invalid PNG logo';end if;
      elsif brand->>'logo' like 'data:image/jpeg;base64,%' then
        if substring(decode(split_part(brand->>'logo',',',2),'base64') from 1 for 3)<>decode('ffd8ff','hex') then raise exception 'Invalid JPEG logo';end if;
      end if;
    exception when others then raise exception 'Invalid customer email logo' using errcode='22023';
    end;
  end if;
  palette:=brand->'palette';
  if jsonb_typeof(palette) is distinct from 'object' or coalesce(palette->>'id','') not in('graphite','ocean','olive','custom') then
    raise exception 'Invalid customer email palette' using errcode='22023';
  end if;
  foreach color_key in array array['accent','ink','muted','paper','surface'] loop
    if jsonb_typeof(palette->color_key) is distinct from 'string' or palette->>color_key !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Invalid customer email color' using errcode='22023';
    end if;
  end loop;
  if public.billing_palette_contrast(palette->>'ink',palette->>'paper')<4.5
    or public.billing_palette_contrast(palette->>'muted',palette->>'paper')<4.5
    or public.billing_palette_contrast(palette->>'ink',palette->>'surface')<4.5
    or public.billing_palette_contrast(palette->>'muted',palette->>'surface')<4.5
    or public.billing_palette_contrast(palette->>'accent',palette->>'paper')<4.5 then
    raise exception 'Insufficient customer email palette contrast' using errcode='22023';
  end if;
  if jsonb_typeof(templates) is distinct from 'object' then raise exception 'Invalid email templates' using errcode='22023';end if;
  foreach key in array array['quote_approval','invoice_due'] loop
    template:=templates->key;
    if jsonb_typeof(template) is distinct from 'object' then raise exception 'Invalid email template: %',key using errcode='22023';end if;
    foreach locale in array array['es','en'] loop
      locale_template:=template->locale;
      if jsonb_typeof(locale_template) is distinct from 'object'
        or jsonb_typeof(locale_template->'subject') is distinct from 'string' or length(locale_template->>'subject')<1 or length(locale_template->>'subject')>180
        or jsonb_typeof(locale_template->'preheader') is distinct from 'string' or length(locale_template->>'preheader')>240
        or jsonb_typeof(locale_template->'html') is distinct from 'string' or length(locale_template->>'html')<1 or length(locale_template->>'html')>50000 then
        raise exception 'Invalid email template: %/%',key,locale using errcode='22023';
      end if;
    end loop;
  end loop;
end $$;

create or replace function public.get_company_customer_email_settings(p_company uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb;
begin
  if not coalesce(public.is_platform_admin() or public.has_company_role(p_company,array['admin']),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
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
  select r.settings into previous_settings from public.company_customer_email_revisions r
    where r.company_id=p_company and r.revision_id=p_revision;
  if previous_settings is null then raise exception 'Email template revision unavailable' using errcode='22023';end if;
  saved_at:=public.save_company_customer_email_settings(p_company,previous_settings);
  return saved_at;
end $$;

-- This RPC returns only a company name and the selected template/brand. It is
-- available to authenticated company admins and the service-role email worker.
create or replace function public.get_company_customer_email_template(p_company uuid,p_template text,p_language text default 'es',p_user uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare settings jsonb;company_name text;
begin
  if p_template not in('quote_approval','invoice_due') or p_language not in('es','en') then raise exception 'Invalid email template' using errcode='22023';end if;
  if coalesce(auth.role(),'')<>'service_role' and not coalesce(p_user=auth.uid() and (public.is_platform_admin() or public.has_company_role(p_company,array['admin'])),false) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select c.name into company_name from public.companies c where c.id=p_company;
  if company_name is null then raise exception 'Company unavailable' using errcode='22023';end if;
  select s.settings into settings from public.company_customer_email_settings s where s.company_id=p_company;
  settings:=coalesce(settings,public.default_company_customer_email_settings());
  return jsonb_build_object('company_name',company_name,'brand',settings->'brand','template',settings->'templates'->p_template->p_language);
end $$;

revoke all on function public.default_company_customer_email_settings(),public.validate_company_customer_email_settings(jsonb),
  public.get_company_customer_email_settings(uuid),public.save_company_customer_email_settings(uuid,jsonb),
  public.get_company_customer_email_revisions(uuid),public.restore_company_customer_email_revision(uuid,uuid),
  public.get_company_customer_email_template(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_company_customer_email_settings(uuid),public.save_company_customer_email_settings(uuid,jsonb),
  public.get_company_customer_email_revisions(uuid),public.restore_company_customer_email_revision(uuid,uuid) to authenticated;
grant execute on function public.get_company_customer_email_template(uuid,text,text,uuid) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
