-- Datos ficticios para las capturas del manual. Ejecutar completo en SQL Editor.
-- SOLO WatchEcommerceDemo. No es una migración ni modifica permisos/esquemas.
-- Repetible: inserta lo que falte y conserva los registros que ya existan.
-- Facturas/cobros son simulaciones de la empresa demo. No mueve dinero.
-- No envía emails: tareas sin recordatorios, facturas nuevas excluidas de avisos,
-- enlaces de respuesta solo para respuestas sintéticas resueltas en esta transacción.
-- No modifica datos previos de otras empresas ni la identidad/configuración existente.
begin;
set local timezone = 'Europe/Madrid';
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $seed$
declare
  tenant uuid; actor uuid; matches integer; missing text; r record; n integer;
  seed text := 'watch-manual-v1'; base_day date := current_date;
  person_id uuid; client_id uuid; stage_id uuid; task_id uuid; object_id uuid;
  issuer jsonb; customer jsonb; doc jsonb; lines jsonb; result jsonb;
  inv public.invoices; quote_row public.quotes; first_invoice uuid;
  token_hash text; created_date date; due_date date; wanted_status text;
begin
  select count(*),min(id::text)::uuid into matches,tenant
    from public.companies where name='WatchEcommerceDemo';
  if matches<>1 then raise exception 'Se esperaba exactamente una empresa WatchEcommerceDemo; no se ha insertado nada.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text||seed,0));
  select user_id into actor from public.company_members
    where company_id=tenant and is_active and role='admin' order by user_id limit 1;
  if actor is null then raise exception 'WatchEcommerceDemo necesita un administrador activo; no se ha insertado nada.'; end if;
  select string_agg(name,', ') into missing from unnest(array[
    'crm_contacts','crm_pipeline_stages','crm_activities','lead','client_company','planning_task',
    'billing','billing_catalog_items','billing_chapter_templates','analytics_events','analytics_daily',
    'analytics_event_definitions','quote_approval_links','quote_approval_responses','crm_billing_links',
    'billing_invoice_reminder_preferences','blog_posts'
  ]) as names(name) where to_regclass('public.'||name) is null;
  if missing is not null then raise exception 'Faltan tablas: %. Aplicar primero las migraciones del proyecto.',missing; end if;
  select string_agg(name,', ') into missing from unnest(array[
    'public.save_invoice(uuid,jsonb,text,uuid,integer)',
    'public.save_quote(uuid,jsonb,text,uuid,integer)',
    'public.register_invoice_payment(uuid,uuid,integer,uuid,numeric,date,text,text)',
    'public.rectify_invoice(uuid,uuid,jsonb,text,text,text,uuid)',
    'public.set_invoice_due_reminders(uuid,uuid,boolean)',
    'public.issue_quote_approval_link(uuid,uuid,text,timestamp with time zone)',
    'public.respond_to_quote_approval(text,text,text,text,text)',
    'public.link_crm_billing_document(uuid,uuid,text,uuid)',
    'public.aggregate_analytics_rollup(date,uuid)'
  ]) as names(name) where to_regprocedure(name) is null;
  if missing is not null then raise exception 'Faltan funciones: %. No se ha insertado nada.',missing; end if;
  if exists(select 1 from unnest(array['crm','planning','billing','analytics','blog']) m
    where not coalesce(public.is_company_module_enabled(tenant,m),false)) then
    raise exception 'Activa los módulos CRM, Planning, Facturación, Analítica y Blog de WatchEcommerceDemo antes de ejecutar.';
  end if;
  if (select count(*) from public.crm_pipeline_stages where company_id=tenant and is_active
      and stage_key in('new','contacted','visit','offer','closed_won','closed_lost'))<>6 then
    raise exception 'Faltan las seis etapas habituales del CRM de la demo. Revisar antes de poblar.';
  end if;

  -- No se modifican auth.users ni roles. Los RPC conservan sus comprobaciones
  -- de servidor usando el administrador que YA pertenece a esta empresa.
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);

  -- Ocho personas y clientes ficticios, con contactos en todas las etapas.
  for r in select * from (values
    (1,'Alicia Montes','alicia.montes@example.test','+34 600 010 101','closed_won',null::integer,'Omega Speedmaster Moonwatch','48270123K','Carrer de la Marina 128, 08013 Barcelona'),
    (2,'Diego Soler','diego.soler@example.test','+34 600 010 102','offer',1,'TAG Heuer Carrera Chronograph','37120456M','Carrer Major 26, 08800 Vilanova i la Geltrú'),
    (3,'Lucía Ribas','lucia.ribas@example.test','+34 600 010 103','visit',0,'Cartier Tank Must Vintage','47680312P','Avinguda del Parc 14, 08195 Sant Cugat'),
    (4,'Marta Vidal','marta.vidal@example.test','+34 600 010 104','contacted',-2,'Tissot PRX Powermatic 80','39507218H','Carrer de Balmes 72, 08007 Barcelona'),
    (5,'Sergio Navarro','sergio.navarro@example.test','+34 600 010 105','new',2,'Rolex Submariner Date 41','52160374L','Passeig de Ponent 31, 08860 Castelldefels'),
    (6,'Clara Ferrer','clara.ferrer@example.test','+34 600 010 106','closed_lost',null,'Seiko Presage Cocktail Time','48019263R','Carrer de la Pau 8, 08201 Sabadell'),
    (7,'Daniel Costa','daniel.costa@example.test','+34 600 010 107','offer',-1,'IWC Portugieser Chronograph','35179028T','Carrer de Sant Pere 17, 08911 Badalona'),
    (8,'Paula Roig','paula.roig@example.test','+34 600 010 108','new',1,'Citizen Promaster Diver','46310825W','Carrer del Port 45, 08302 Mataró')
  ) as v(i,name,email,phone,stage,follow_days,item,tax_id,address) loop
    person_id:=md5(tenant::text||seed||':contact:'||r.i)::uuid;
    client_id:=md5(tenant::text||seed||':client:'||r.i)::uuid;
    if exists(select 1 from public.crm_contacts where id=person_id and company_id<>tenant)
       or exists(select 1 from public.client_company where id=client_id and company_id<>tenant) then
      raise exception 'Colisión de IDs de demo con otra empresa; operación cancelada.';
    end if;
    select id into stage_id from public.crm_pipeline_stages where company_id=tenant and stage_key=r.stage;
    insert into public.crm_contacts(id,company_id,name,email,phone,stage_id,assigned_to,next_follow_up_at,
      source_path,source_item,source_referrer,source_utm_source,source_utm_medium,source_utm_campaign,
      consent_given,consent_at,consent_text_version,consent_source,created_at)
    values(person_id,tenant,r.name,r.email,r.phone,stage_id,actor,
      case when r.follow_days is not null then (base_day+r.follow_days+time '11:30') at time zone 'Europe/Madrid' end,
      '/relojes/'||case r.i when 1 then 'omega-speedmaster' when 2 then 'tag-heuer-carrera' else 'coleccion' end,
      r.item,'www.google.com',case when r.i%2=0 then 'instagram' else 'google' end,
      case when r.i%2=0 then 'social' else 'organic' end,'coleccion-otono',
      true,now()-make_interval(days=>r.i), 'privacidad-demo-2026-10','public_contact_form',now()-make_interval(days=>r.i+2))
    on conflict(id) do nothing;
    insert into public.client_company(id,company_id,user_id,name,tax_id,billing_address,email,phone,responsible,color,updated_by)
    values(client_id,tenant,actor,r.name,r.tax_id,r.address,r.email,r.phone,r.name,
      (array['#1f63cc','#0f766e','#b45309','#6d28d9'])[1+(r.i-1)%4],actor)
    on conflict(id) do nothing;

    object_id:=md5(tenant::text||seed||':lead:'||r.i)::uuid;
    if exists(select 1 from public.lead where id=object_id and company_id<>tenant) then raise exception 'Colisión de solicitud entre empresas'; end if;
    insert into public.lead(id,company_id,name,email,phone,message,source_path,source_item,source_campaign,
      source_referrer,source_utm_source,source_utm_medium,consent_given,consent_at,consent_text_version,consent_source,
      status,notes,created_at,handled_by)
    values(object_id,tenant,r.name,r.email,r.phone,
      (array[
        'Me interesa el Omega Speedmaster. ¿Incluye caja y documentación? Querría recogerlo en boutique el viernes.',
        'Quiero reservar el TAG Heuer Carrera para un regalo. ¿Podéis preparar un presupuesto con correa adicional y grabado?',
        'Busco un Cartier Tank vintage. ¿Podemos concertar una cita para verlo y comprobar la medida de la correa?',
        '¿Tenéis disponible el Tissot PRX azul? Me gustaría saber el plazo de entrega y las opciones de pago.',
        'Estoy buscando un Submariner de 41 mm con documentación. ¿Aceptáis mi reloj actual como parte del pago?',
        'Gracias por la propuesta del Seiko. Al final he elegido otro modelo, pero me gustaría conocer próximas novedades.',
        '¿Podéis enviarme una propuesta del IWC Portugieser con revisión, estuche y entrega asegurada?',
        'Necesito información sobre el Citizen Promaster Diver. ¿Incluye ajuste de brazalete y prueba de hermeticidad?'
      ])[r.i], '/relojes/'||case r.i when 1 then 'omega-speedmaster' when 2 then 'tag-heuer-carrera' else 'coleccion' end,
      r.item,'coleccion-otono','www.google.com',case when r.i%2=0 then 'instagram' else 'google' end,
      case when r.i%2=0 then 'social' else 'organic' end,true,now()-make_interval(days=>r.i),'privacidad-demo-2026-10','public_contact_form',
      case when r.stage in('closed_won','closed_lost') then 'closed' when r.stage='new' then 'new' else 'contacted' end,
      case when r.stage='closed_won' then 'Entrega acordada y documentación preparada.' when r.stage='offer' then 'Propuesta en preparación. Revisar condiciones y confirmar disponibilidad.' else 'Seguimiento desde la boutique de Barcelona.' end,
      now()-make_interval(days=>r.i),actor)
    on conflict(id) do nothing;

    object_id:=md5(tenant::text||seed||':activity:'||r.i)::uuid;
    if exists(select 1 from public.crm_activities where id=object_id and company_id<>tenant) then raise exception 'Colisión de actividad entre empresas'; end if;
    insert into public.crm_activities(id,company_id,contact_id,kind,title,details,occurred_at,created_by)
    values(object_id,tenant,person_id,case when r.i%2=0 then 'call' else 'note' end,
      case when r.i%2=0 then 'Llamada de seguimiento' else 'Preferencias del cliente' end,
      case when r.i%2=0 then 'Hemos revisado disponibilidad, plazo de reserva y condiciones. Enviar propuesta por email.'
      else 'Prefiere recogida en boutique y conservar el estuche original. Confirmar ajuste antes de entregar.' end,
      now()-make_interval(hours=>r.i*3),actor) on conflict(id) do nothing;
  end loop;

  -- Previsiones de Planning: no son cobros de facturas ni envían avisos.
  for r in select * from (values
    (1,2,'Reserva y personalización TAG Heuer',1,600::numeric,'cobrar'),
    (2,3,'Revisión y ajuste Cartier Tank',3,217.80,'cobrar'),
    (3,1,'Material de taller y correas',4,185,'pagar'),
    (4,4,'Entrega Tissot PRX',7,750.20,'cobrar')
  ) as v(i,client,title,day_offset,amount,direction) loop
    object_id:=md5(tenant::text||seed||':forecast:'||r.i)::uuid;
    if exists(select 1 from public.billing where id=object_id and company_id<>tenant) then raise exception 'Colisión de previsión entre empresas'; end if;
    insert into public.billing(id,company_id,client_company_id,title,description,billing_date,amount,direction,recurrence_type,attachments,created_by)
    values(object_id,tenant,md5(tenant::text||seed||':client:'||r.client)::uuid,r.title,
      'Previsión de boutique para organizar la semana. El cobro real se registra en la factura.',
      base_day+r.day_offset,r.amount,r.direction,'none','[]',actor)
    on conflict(id) do nothing;
  end loop;

  -- Cuatro consultas adicionales: variedad de fechas, estado y mensaje.
  for n in 9..12 loop
    object_id:=md5(tenant::text||seed||':lead:'||n)::uuid;
    if exists(select 1 from public.lead where id=object_id and company_id<>tenant) then raise exception 'Colisión de solicitud entre empresas'; end if;
    insert into public.lead(id,company_id,name,email,phone,message,source_path,source_item,status,created_at,handled_by)
    select object_id,tenant,c.name,c.email,c.phone,
      case n when 9 then '¿Podéis confirmar si la revisión y el cambio de correa pueden estar listos esta semana?'
        when 10 then 'He visto vuestra selección de relojes vintage. Quiero comparar los dos modelos antes de decidir.'
        when 11 then 'Confirmo que puedo pasar mañana por la tarde. ¿Tenéis disponibilidad a las 17:00?'
        else 'Quiero añadir un estuche de viaje al pedido. ¿Podéis incluirlo en la propuesta?' end,
      '/contacto','Consulta de boutique',case when n%2=0 then 'new' else 'contacted' end,
      now()-make_interval(hours=>n),actor
    from public.crm_contacts c where c.company_id=tenant and c.id=md5(tenant::text||seed||':contact:'||(n-8))::uuid
    on conflict(id) do nothing;
  end loop;

  -- Calendario de esta semana y la próxima. Sin recordatorios por email.
  for r in select * from (values
    (1,1,'Entrega Omega Speedmaster','entregable',2,10,60),
    (2,2,'Revisar propuesta TAG Heuer','todo',2,12,45),
    (3,3,'Cita en boutique · Cartier Tank','reunion',3,17,60),
    (4,4,'Confirmar stock Tissot PRX','todo',1,11,30),
    (5,5,'Valoración de reloj para intercambio','reunion',4,11,90),
    (6,7,'Preparar documentación IWC','entregable',4,16,60),
    (7,8,'Ajuste y hermeticidad Citizen','todo',5,10,60),
    (8,2,'Seguimiento de propuesta','reunion',7,12,30),
    (9,1,'Revisión posventa','todo',8,10,45),
    (10,3,'Entrega de correa y estuche','entregable',9,17,45)
  ) as v(i,client,title,type,day_offset,hour,duration) loop
    task_id:=md5(tenant::text||seed||':task:'||r.i)::uuid;
    if exists(select 1 from public.planning_task where id=task_id and company_id<>tenant) then raise exception 'Colisión de tarea entre empresas'; end if;
    insert into public.planning_task(id,company_id,client_company_id,title,description,type,start_datetime,end_datetime,
      created_by,is_all_day,recurrence_type,reminders,attachments)
    values(task_id,tenant,md5(tenant::text||seed||':client:'||r.client)::uuid,r.title,
      'Comprobar disponibilidad, documentación y preferencias antes de contactar al cliente.',r.type,
      (date_trunc('week',base_day::timestamp)+make_interval(days=>r.day_offset,hours=>r.hour)) at time zone 'Europe/Madrid',
      (date_trunc('week',base_day::timestamp)+make_interval(days=>r.day_offset,hours=>r.hour,mins=>r.duration)) at time zone 'Europe/Madrid',
      actor,false,'none','{}','[]') on conflict(id) do nothing;
  end loop;

  -- Catálogo y estructura reutilizable (sin sobrescribir conceptos previos).
  for r in select * from (values
    (1,'Omega Speedmaster Moonwatch','Reloj mecánico con estuche y documentación','ud',5950::numeric),
    (2,'TAG Heuer Carrera Chronograph','Cronógrafo automático, revisión incluida','ud',3850),
    (3,'Revisión de reloj automático','Diagnóstico, limpieza y regulación','servicio',180),
    (4,'Correa de piel artesanal','Correa de piel con ajuste a medida','ud',95),
    (5,'Grabado personalizado','Grabado de iniciales en fondo de caja','servicio',45),
    (6,'Entrega asegurada','Transporte protegido con seguimiento','envío',25)
  ) as v(i,name,description,unit,price) loop
    object_id:=md5(tenant::text||seed||':catalog:'||r.i)::uuid;
    if exists(select 1 from public.billing_catalog_items where id=object_id and company_id<>tenant) then raise exception 'Colisión de catálogo entre empresas'; end if;
    insert into public.billing_catalog_items(id,company_id,name,description,unit,price,tax,created_by,updated_by)
    values(object_id,tenant,r.name,r.description,r.unit,r.price,21,actor,actor) on conflict do nothing;
  end loop;
  lines:='[
    {"id":"watch-selection","chapter":"01 · Selección del reloj","description":"TAG Heuer Carrera Chronograph","details":"Revisión previa, documentación y estuche original incluidos.","quantity":1,"price":3850,"discount":5,"tax":21},
    {"id":"watch-strap","chapter":"02 · Personalización y entrega","description":"Correa de piel artesanal","details":"Ajuste de longitud en boutique.","quantity":1,"price":95,"discount":0,"tax":21},
    {"id":"watch-engraving","chapter":"02 · Personalización y entrega","description":"Grabado personalizado","quantity":1,"price":45,"discount":0,"tax":21},
    {"id":"watch-delivery","chapter":"02 · Personalización y entrega","description":"Entrega asegurada","quantity":1,"price":25,"discount":0,"tax":21}
  ]'::jsonb;
  object_id:=md5(tenant::text||seed||':template:1')::uuid;
  if exists(select 1 from public.billing_chapter_templates where id=object_id and company_id<>tenant) then raise exception 'Colisión de plantilla entre empresas'; end if;
  insert into public.billing_chapter_templates(id,company_id,name,lines,created_by,updated_by)
  values(object_id,tenant,'Reloj con personalización y entrega',lines,actor,actor) on conflict do nothing;

  -- Copia la apariencia ya elegida por el usuario. Los datos por defecto NO cambian.
  select profile into issuer from public.invoice_settings where company_id=tenant;
  issuer:=coalesce(issuer,'{}')||jsonb_build_object('name','WatchEcommerceDemo',
    'taxId','B12345674','address','Carrer del Temps 24, 08008 Barcelona',
    'email','boutique@watchatelier.example.test','phone','+34 930 000 240',
    'payment','Transferencia bancaria a 15 días','iban','ES00 0000 0000 0000 0000 0000');

  -- Cuatro presupuestos completos: borrador, enviado, aceptado y rechazado.
  for n in 1..4 loop
    select jsonb_build_object('name',name,'taxId',tax_id,'address',billing_address,'email',email)
      into customer from public.client_company where company_id=tenant and id=md5(tenant::text||seed||':client:'||(n+1))::uuid;
    select * into quote_row from public.quotes where company_id=tenant and document->>'demoSeed'=seed||':quote:'||n;
    if found then continue; end if;
    doc:=jsonb_build_object('demoSeed',seed||':quote:'||n,'issuer',issuer,'customer',customer,
      'date',(base_day-3)::text,'dueDate',(base_day+21)::text,'withholding',0,'lines',lines,
      'payment','30 % al reservar y resto antes de la entrega.','iban','ES00 0000 0000 0000 0000 0000',
      'notes','Reserva sujeta a disponibilidad. Documentación y garantía entregadas con el reloj.',
      'presentation',jsonb_build_object('title','Selección y personalización de reloj',
        'site','Boutique Barcelona · cita privada','introduction','Una propuesta preparada a medida, con revisión previa, ajuste y entrega asegurada.',
        'conditions','Validez de 21 días. El grabado se confirma por escrito antes de realizarlo. No incluye servicios no detallados en las partidas.',
        'signatures',true));
    doc:=jsonb_set(doc,'{lines,0,description}',to_jsonb((array['TAG Heuer Carrera Chronograph','Cartier Tank Must Vintage','Tissot PRX Powermatic 80','Rolex Submariner Date 41'])[n]));
    doc:=jsonb_set(doc,'{lines,0,price}',to_jsonb((array[3850,2950,620,8950])[n]));
    quote_row:=public.save_quote(tenant,doc,'draft',null,null);
    if n>1 then
      quote_row:=public.save_quote(tenant,doc,'sent',quote_row.id,quote_row.version);
    end if;
    if n in(3,4) then
      token_hash:=md5(tenant::text||seed||':response:'||n)||md5(tenant::text||seed||':token:'||n);
      perform public.issue_quote_approval_link(tenant,quote_row.id,token_hash,now()+interval '30 days');
      perform public.respond_to_quote_approval(token_hash,case when n=3 then 'accepted' else 'rejected' end,
        customer->>'name',customer->>'email',case when n=4 then 'Prefiero una esfera diferente. Revisaremos la alternativa la próxima semana.' else null end);
    end if;
    perform public.link_crm_billing_document(tenant,md5(tenant::text||seed||':contact:'||(n+1))::uuid,'quote',quote_row.id);
  end loop;

  -- Cuatro facturas: pagada, cobro parcial, vencida y borrador con historial.
  for n in 1..4 loop
    select * into inv from public.invoices where company_id=tenant and document->>'demoSeed'=seed||':invoice:'||n;
    if found then
      if n=2 then first_invoice:=inv.id; end if;
      continue;
    end if;
    select jsonb_build_object('name',name,'taxId',tax_id,'address',billing_address,'email',email)
      into customer from public.client_company where company_id=tenant and id=md5(tenant::text||seed||':client:'||n)::uuid;
    created_date:=base_day-case when n=3 then 24 else 7 end;
    due_date:=case when n=3 then base_day-9 else base_day+8 end;
    doc:=jsonb_build_object('demoSeed',seed||':invoice:'||n,'issuer',issuer,'customer',customer,
      'date',created_date::text,'dueDate',due_date::text,'withholding',0,
      'lines',case when n=1 then '[{"description":"Omega Speedmaster Moonwatch","quantity":1,"price":5950,"discount":0,"tax":21},{"description":"Ajuste y entrega en boutique","quantity":1,"price":45,"discount":0,"tax":21}]'::jsonb
        else '[{"description":"Revisión de reloj automático","quantity":1,"price":180,"discount":0,"tax":21},{"description":"Correa de piel artesanal","quantity":1,"price":95,"discount":0,"tax":21},{"description":"Entrega asegurada","quantity":1,"price":25,"discount":0,"tax":21}]'::jsonb end,
      'payment','Transferencia bancaria a 15 días','iban','ES00 0000 0000 0000 0000 0000',
      'notes','Revisión y ajuste incluidos. Conservar este documento junto a la garantía del reloj.');
    if n=2 then
      doc:=jsonb_set(doc,'{lines,0,description}',to_jsonb('Reserva TAG Heuer Carrera Chronograph'::text));
      doc:=jsonb_set(doc,'{lines,0,price}',to_jsonb(1155));
    elsif n=4 then
      doc:=jsonb_set(doc,'{lines,0,description}',to_jsonb('Tissot PRX Powermatic 80'::text));
      doc:=jsonb_set(doc,'{lines,0,price}',to_jsonb(620));
    end if;
    inv:=public.save_invoice(tenant,doc,'draft',null,null);
    if n<4 then
      inv:=public.save_invoice(tenant,doc,'issued',inv.id,inv.version);
      if n in(1,2) then
        perform public.register_invoice_payment(tenant,inv.id,inv.version,
          md5(tenant::text||seed||':payment:'||n)::uuid,
          case when n=1 then public.billing_document_total(doc) else 150 end,
          base_day-2,'Transferencia','Reserva boutique · '||(customer->>'name'));
      end if;
    else
      doc:=jsonb_set(doc,'{notes}',to_jsonb('Añadido el ajuste de brazalete. Revisar dirección de entrega antes de emitir.'::text));
      inv:=public.save_invoice(tenant,doc,'draft',inv.id,inv.version);
    end if;
    -- También protege el borrador si se emite más adelante; el RPC ordinario
    -- solo admite facturas emitidas, por eso el seed crea esta preferencia.
    insert into public.billing_invoice_reminder_preferences(company_id,invoice_id,suppressed,updated_by)
    values(tenant,inv.id,true,actor) on conflict(company_id,invoice_id) do nothing;
    perform public.link_crm_billing_document(tenant,md5(tenant::text||seed||':contact:'||n)::uuid,'invoice',inv.id);
    if n=2 then first_invoice:=inv.id; end if;
  end loop;

  -- Una rectificativa ficticia para mostrar el saldo a favor y su referencia.
  object_id:=md5(tenant::text||seed||':rectification:1')::uuid;
  if not exists(select 1 from public.invoices where company_id=tenant and rectification_request_id=object_id) then
    select document into doc from public.invoices where company_id=tenant and id=first_invoice;
    doc:=(doc-'rectification')||jsonb_build_object('demoSeed',seed||':rectification:1',
      'date',base_day::text,'dueDate',(base_day+8)::text,
      'lines','[{"description":"Abono de correa sustituida por garantía","quantity":1,"price":95,"discount":0,"tax":21,"sign":-1}]'::jsonb);
    inv:=public.rectify_invoice(tenant,first_invoice,doc,'difference','other','Sustitución de la correa cubierta por garantía.',object_id);
    perform public.set_invoice_due_reminders(tenant,inv.id,true);
  end if;

  -- Artículos editoriales propios de una boutique de relojería.
  for r in select * from (values
    (1,'como-elegir-tu-primer-reloj-automatico','Cómo elegir tu primer reloj automático','Guía para elegir con criterio','Movimiento, tamaño y uso diario: las claves para encontrar un reloj que encaje contigo.',
      '## Empieza por cómo lo vas a usar' || chr(10) || 'Un reloj de diario debe resultar cómodo y legible. Prueba distintos diámetros y comprueba el ajuste de la correa.' || chr(10) || '## Revisa la documentación' || chr(10) || 'Conserva la factura, la garantía y las revisiones. En boutique te ayudamos a comparar opciones.','published'),
    (2,'cuidar-un-reloj-vintage-cinco-habitos-sencillos','Cuidar un reloj vintage: cinco hábitos sencillos','Conservar una pieza con historia','Pequeños gestos que ayudan a mantener tu reloj vintage en buenas condiciones.',
      '## Guarda el reloj en un lugar seco' || chr(10) || 'Evita golpes y cambios bruscos de temperatura. Consulta las condiciones de hermeticidad antes de exponerlo al agua.' || chr(10) || '## Planifica la revisión' || chr(10) || 'Anota la última revisión y pregunta al taller por el mantenimiento adecuado.','draft')
  ) as v(i,slug,title,heading,intro,body,status) loop
    object_id:=md5(tenant::text||seed||':post:'||r.i)::uuid;
    if exists(select 1 from public.blog_posts where id=object_id and company_id<>tenant) then raise exception 'Colisión de artículo entre empresas'; end if;
    -- Con slug: sin él las webs no muestran el artículo. Si ya existía sin slug, se completa.
    insert into public.blog_posts(id,company_id,slug,title,heading,intro,body,status,created_by,last_edited_by)
    values(object_id,tenant,r.slug,r.title,r.heading,r.intro,r.body,r.status,actor,actor)
    on conflict(id) do update set slug=coalesce(public.blog_posts.slug,excluded.slug);
  end loop;

  -- 30 días de tráfico sintético. Se conservan también los eventos crudos
  -- para que una agregación posterior no borre los datos de las gráficas.
  -- Índice TEMPORAL: acelera la repetición sin crear índices/tablas persistentes.
  create temporary table watch_manual_existing_sessions on commit drop as
    select distinct session_id from public.analytics_events
    where company_id=tenant and session_id like seed||':pv:%';
  create unique index on watch_manual_existing_sessions(session_id);
  insert into public.analytics_event_definitions(company_id,key,label,created_by,last_edited_by)
  values(tenant,'whatsapp_click','Clic en WhatsApp',actor,actor),
        (tenant,'form_open','Apertura del formulario de consulta',actor,actor)
  on conflict(company_id,key) do nothing;
  insert into public.analytics_events(company_id,event_type,event_key,path,session_id,visitor,device,country,lang,
    referrer,utm_source,utm_medium,utm_campaign,created_at,value)
  select tenant,'page_view',null,
    (array['/','/relojes','/relojes/omega-speedmaster','/relojes/tag-heuer-carrera','/contacto','/blog/primer-reloj-automatico'])[1+(i%6)],
    seed||':pv:'||(base_day-d)::text||':'||i,md5(seed||':'||(base_day-d)::text||':'||(i%43)),
    case when i%10<6 then 'mobile' when i%10=9 then 'tablet' else 'desktop' end,
    case when i%13=0 then 'FR' when i%17=0 then 'DE' else 'ES' end,
    case when i%7=0 then 'en' else 'es' end,
    case when i%4=0 then 'www.google.com' when i%4=1 then 'www.instagram.com' else null end,
    case when i%4=0 then 'google' when i%4=1 then 'instagram' when i%4=2 then 'newsletter' else null end,
    case when i%4=0 then 'organic' when i%4=1 then 'social' when i%4=2 then 'email' else null end,
    case when i%4 in(1,2) then 'coleccion-otono' else null end,
    (((base_day-d)+time '10:00') at time zone 'Europe/Madrid')+make_interval(mins=>i*5),null
  from generate_series(0,29) d cross join lateral generate_series(1,48+(d*17)%55) i
  where not exists(select 1 from watch_manual_existing_sessions e
    where e.session_id=seed||':pv:'||(base_day-d)::text||':'||i);

  insert into public.analytics_events(company_id,event_type,event_key,path,session_id,visitor,created_at,value)
  select tenant,v.event_type,v.event_key,e.path,e.session_id||':'||v.suffix,e.visitor,e.created_at+interval '30 seconds',v.value
  from public.analytics_events e
  cross join lateral (values
    ('engagement',null::text,'engagement',12+(abs(hashtext(e.session_id)::bigint)%240)::integer),
    ('scroll_depth',null,'scroll25',25),('scroll_depth',null,'scroll50',50),
    ('scroll_depth',null,'scroll75',75),('scroll_depth',null,'scroll100',100),
    ('cta_click',case when abs(hashtext(e.session_id)::bigint)%3=0 then 'phone_click'
      when abs(hashtext(e.session_id)::bigint)%3=1 then 'whatsapp_click' else 'form_submit' end,'cta',null::integer)
  ) as v(event_type,event_key,suffix,value)
  where e.company_id=tenant and e.event_type='page_view' and e.session_id like seed||':pv:%'
    and (v.event_type='engagement' or v.event_type='scroll_depth' and v.value<=25*(1+abs(hashtext(e.session_id)::bigint)%4)
      or v.event_type='cta_click' and abs(hashtext(e.session_id)::bigint)%19=0)
    and not exists(select 1 from watch_manual_existing_sessions prior where prior.session_id=e.session_id||':'||v.suffix);

  for n in 0..29 loop perform public.aggregate_analytics_rollup(base_day-n,tenant); end loop;
  raise notice 'Datos ficticios listos en WatchEcommerceDemo. No se ha invocado ningún servicio de envío.';
end $seed$;

-- Resultado verificable, sin secretos. Si algo falla se revierte TODO el lote.
select c.name as empresa,
  (select count(*) from public.lead l where l.company_id=c.id and l.id in(
    select md5(c.id::text||'watch-manual-v1:lead:'||i)::uuid from generate_series(1,12) i)) as solicitudes_demo,
  (select count(*) from public.crm_contacts p where p.company_id=c.id and p.id in(
    select md5(c.id::text||'watch-manual-v1:contact:'||i)::uuid from generate_series(1,8) i)) as contactos_demo,
  (select count(*) from public.planning_task t where t.company_id=c.id and t.id in(
    select md5(c.id::text||'watch-manual-v1:task:'||i)::uuid from generate_series(1,10) i)) as tareas_demo,
  (select count(*) from public.quotes q where q.company_id=c.id and q.document->>'demoSeed' like 'watch-manual-v1:%') as presupuestos_demo,
  (select count(*) from public.invoices i where i.company_id=c.id and i.document->>'demoSeed' like 'watch-manual-v1:%') as facturas_demo,
  (select count(*) from public.analytics_daily a where a.company_id=c.id and a.day between current_date-29 and current_date) as dias_analitica
from public.companies c where c.name='WatchEcommerceDemo';
commit;
