import { afterAll,beforeAll,expect,it } from 'vitest'
import { database,document,ids,login,save,sqlFile } from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  await db.exec(`
    create role service_role;
    alter table public.company_members add constraint company_members_company_user_unique unique(company_id,user_id);
    create table public.lead(
      id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
      name text not null,email text,phone text,message text,source_path text,source_campaign text,
      status text not null default 'new',notes text,created_at timestamptz not null default now(),
      updated_at timestamptz,handled_by uuid references auth.users(id) on delete set null
    );
    grant select,insert,update,delete on public.lead to authenticated;
  `)
  await db.exec(await sqlFile('schema/LEADS_SCHEMA.sql'))
  await db.query("insert into public.lead(company_id,name,email,status) values($1,'Solicitud anterior','old@example.test','closed')",[ids.a])
  const preflightSql=await sqlFile('maintenance/CRM_RETENTION_REVIEW_PREFLIGHT.sql')
  const preflightBefore=(await db.query(preflightSql)).rows[0]
  expect(preflightBefore).toMatchObject({crm_contacts_exists:false,crm_billing_links_exists:false,crm_retention_settings_table_exists:false})
  const migration=await sqlFile('migrations/CRM_CONTACTS_PIPELINE.sql')
  await db.exec(migration)
  await db.exec(migration)
  const resolvedActivity=await sqlFile('migrations/CRM_REVIEW_ACTIVITY_LINK.sql')
  await db.exec(resolvedActivity)
  await db.exec(resolvedActivity)
  const privacy=await sqlFile('migrations/CRM_PRIVACY_CONTROLS.sql')
  await db.exec(privacy)
  await db.exec(privacy)
  const billingLinks=await sqlFile('migrations/CRM_BILLING_LINKS.sql')
  await db.exec(billingLinks)
  await db.exec(billingLinks)
  const retentionReview=await sqlFile('migrations/CRM_RETENTION_REVIEW.sql')
  await db.exec(retentionReview)
  await db.exec(retentionReview)
  const preflightAfter=(await db.query(preflightSql)).rows[0]
  expect(preflightAfter).toMatchObject({lead_crm_columns_present:true,crm_contacts_exists:true,crm_contact_review_columns_present:true,crm_activities_exists:true,crm_activity_columns_present:true,crm_billing_links_exists:true,crm_billing_link_review_columns_present:true,crm_privacy_admin_rpc_exists:true,crm_review_activity_function_exists:true,crm_review_activity_trigger_exists:true,crm_retention_settings_table_exists:true,crm_retention_rls_enabled:true,crm_retention_get_rpc_exists:true,crm_retention_save_rpc_exists:true,crm_retention_direct_select_denied:true,crm_retention_get_rpc_granted:true})
  await login(db)
},30000)
afterAll(async()=>db?.close())

const insertLead=async(company_id,values={})=>{
  await db.exec('reset role')
  const {rows:[lead]}=await db.query(`insert into public.lead(company_id,name,email,phone,message,source_path,source_campaign,source_utm_source,consent_given,consent_text_version,consent_source)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,[
    company_id,values.name||'Persona',values.email??null,values.phone??null,values.message??null,
    values.path??'/contacto',values.campaign??null,values.utm??null,values.consent??false,
    values.consentVersion??null,values.consent? 'public_contact_form':null,
  ])
  const {rows:[processed]}=await db.query('select * from public.lead where id=$1',[lead.id])
  await login(db)
  return processed
}

it('creates a contact and form activity automatically with company-scoped pipeline/source/consent',async()=>{
  const lead=await insertLead(ids.a,{name:'Ana',email:' Ana@Example.test ',phone:'+34 600 100 200',message:'Quiero información',campaign:'verano',utm:'web',consent:true,consentVersion:'privacy-3'})
  expect(lead.crm_match_state).toBe('linked')
  expect(lead.crm_contact_id).toBeTruthy()
  const {rows:[contact]}=await db.query('select * from public.crm_contacts where id=$1',[lead.crm_contact_id])
  expect(contact).toMatchObject({company_id:ids.a,name:'Ana',email:' Ana@Example.test ',source_path:'/contacto',source_utm_campaign:'verano',source_utm_source:'web',consent_given:true,consent_text_version:'privacy-3',consent_source:'public_contact_form'})
  expect(contact.email_normalized).toBe('ana@example.test')
  expect(contact.phone_normalized).toBe('34600100200')
  const {rows:[stage]}=await db.query('select stage_key from public.crm_pipeline_stages where id=$1',[lead.crm_stage_id])
  expect(stage.stage_key).toBe('new')
  const {rows:[activity]}=await db.query('select kind,title,contact_id,lead_id from public.crm_activities where lead_id=$1',[lead.id])
  expect(activity).toMatchObject({kind:'form',title:'Solicitud recibida',contact_id:lead.crm_contact_id,lead_id:lead.id})
})

it('keeps already-closed leads in a historical unclassified stage during backfill',async()=>{
  const {rows:[legacy]}=await db.query("select crm_match_state,crm_stage_id from public.lead where email='old@example.test'")
  expect(legacy.crm_match_state).toBe('linked')
  expect((await db.query('select stage_key from public.crm_pipeline_stages where id=$1',[legacy.crm_stage_id])).rows[0].stage_key).toBe('legacy_closed')
})

it('links an incoming request by either normalized email or phone when both identify one contact',async()=>{
  const first=await insertLead(ids.a,{email:'ana@example.test',phone:'600 100 200'})
  const second=await insertLead(ids.a,{email:'ANA@example.test',phone:'600100200'})
  expect(second.crm_contact_id).toBe(first.crm_contact_id)
  expect((await db.query("select count(*)::int as count from public.crm_contacts where company_id=$1 and email_normalized='ana@example.test'",[ids.a])).rows[0].count).toBe(1)
})

it('requires manual review when email and phone resolve to different contacts',async()=>{
  const byEmail=await insertLead(ids.a,{email:'a@example.test',phone:'600000001'})
  const byPhone=await insertLead(ids.a,{email:'b@example.test',phone:'600000002'})
  const ambiguous=await insertLead(ids.a,{email:'a@example.test',phone:'600000002'})
  expect(byEmail.crm_match_state).toBe('linked')
  expect(byPhone.crm_match_state).toBe('linked')
  expect(ambiguous.crm_match_state).toBe('review_required')
  expect(ambiguous.crm_contact_id).toBeNull()
  expect((await db.query('select kind,title,contact_id from public.crm_activities where lead_id=$1',[ambiguous.id])).rows[0]).toMatchObject({kind:'form',title:'Solicitud pendiente de vinculación',contact_id:null})
})

it('isolates contacts and pipeline per tenant and gives viewers read-only access',async()=>{
  await insertLead(ids.a,{email:'a@example.test'})
  await insertLead(ids.b,{email:'b@example.test'})
  expect((await db.query('select company_id from public.crm_contacts')).rows.every(row=>row.company_id===ids.a)).toBe(true)
  await expect(db.query("insert into public.crm_contacts(company_id,name) values($1,'No')",[ids.b])).rejects.toThrow()
  await db.exec('reset role')
  await db.query("update public.company_members set role='viewer' where company_id=$1 and user_id=$2",[ids.a,ids.editor])
  await login(db,'editor')
  await expect(db.query("insert into public.crm_pipeline_stages(company_id,stage_key,name,position) values($1,'custom','Custom',10)",[ids.a])).rejects.toThrow()
  await login(db,'editorB')
  expect((await db.query('select company_id from public.crm_contacts')).rows.map(row=>row.company_id)).toEqual([ids.b])
  expect((await db.query('select company_id from public.crm_pipeline_stages')).rows.every(row=>row.company_id===ids.b)).toBe(true)
})

it('prevents authenticated users from forging the system-managed lead contact linkage',async()=>{
  await db.exec('reset role')
  await db.query("update public.company_members set role='editor' where company_id=$1 and user_id=$2",[ids.a,ids.editor])
  const lead=await insertLead(ids.a,{email:'a@example.test'})
  const {rows:[contact]}=await db.query('select id from public.crm_contacts where id=$1',[lead.crm_contact_id])
  const {rows:[another]}=await db.query("insert into public.crm_contacts(company_id,name) values($1,'Otra') returning id",[ids.a])
  await login(db,'editor')
  await expect(db.query('update public.lead set crm_contact_id=$1 where company_id=$2',[another.id,ids.a])).rejects.toThrow('system-managed')
  expect((await db.query('select crm_contact_id from public.lead where id=$1',[lead.id])).rows[0].crm_contact_id).toBe(contact.id)
  await expect(db.query('update public.crm_activities set title=title')).rejects.toThrow()
})

it('resolves ambiguous leads explicitly and preserves their original request on the selected contact timeline',async()=>{
  const one=await insertLead(ids.a,{email:'resolve-a@example.test',phone:'600010001'})
  const two=await insertLead(ids.a,{email:'resolve-b@example.test',phone:'600010002'})
  const review=await insertLead(ids.a,{email:'resolve-a@example.test',phone:'600010002',message:'Necesito una visita esta semana'})
  await login(db,'editor')
  const {rows:[linked]}=await db.query('select public.resolve_crm_lead_contact($1,$2,$3,false) as id',[ids.a,review.id,one.crm_contact_id])
  expect(linked.id).toBe(one.crm_contact_id)
  const preserved=(await db.query("select kind,title,details,contact_id,lead_id from public.crm_activities where lead_id=$1 and contact_id=$2 and kind='form'",[review.id,one.crm_contact_id])).rows
  expect(preserved).toEqual([expect.objectContaining({kind:'form',title:'Solicitud recibida',details:'Necesito una visita esta semana',contact_id:one.crm_contact_id,lead_id:review.id})])
  await db.exec('reset role')
  await db.query("update public.lead set crm_match_state='linked' where id=$1",[review.id])
  expect((await db.query("select id from public.crm_activities where lead_id=$1 and contact_id=$2 and kind='form'",[review.id,one.crm_contact_id])).rows).toHaveLength(1)
  await login(db,'editor')
  const reviewNew=await insertLead(ids.a,{email:'resolve-a@example.test',phone:'600010002'})
  await db.query('select 1')
  const {rows:[created]}=await db.query('select public.resolve_crm_lead_contact($1,$2,null,true) as id',[ids.a,reviewNew.id])
  expect(created.id).toBeTruthy()
  expect(created.id).not.toBe(one.crm_contact_id)
  expect(created.id).not.toBe(two.crm_contact_id)
  expect((await db.query('select crm_match_state from public.lead where id=$1',[reviewNew.id])).rows[0].crm_match_state).toBe('linked')
})

it('exports CRM records, restricts privacy actions to company admins, then anonymizes without altering invoices',async()=>{
  const lead=await insertLead(ids.a,{name:'Privacy Subject',email:'privacy@example.test',phone:'600123456',message:'Sensitive request',campaign:'private-campaign',consent:true,consentVersion:'privacy-v1'})
  await db.exec('reset role')
  await db.query("insert into public.crm_activities(company_id,contact_id,lead_id,kind,title,details) values($1,$2,$3,'note','Sensitive note','Private details')",[ids.a,lead.crm_contact_id,lead.id])
  const savedInvoice=await save(db,ids.a,document(),'issued')

  await login(db,'viewer')
  await expect(db.query('select public.preview_crm_contact_anonymization($1,$2)',[ids.a,lead.crm_contact_id])).rejects.toThrow('Forbidden')
  await expect(db.query('select public.export_crm_contact($1,$2)',[ids.a,lead.crm_contact_id])).rejects.toThrow('Forbidden')

  await db.exec('reset role')
  await db.query("update public.company_members set role='admin' where company_id=$1 and user_id=$2",[ids.a,ids.editor])
  await login(db)
  const preview=(await db.query('select public.preview_crm_contact_anonymization($1,$2) as result',[ids.a,lead.crm_contact_id])).rows[0].result
  expect(preview).toEqual({lead_count:1,activity_count:2,billing_document_count:0})
  const exported=(await db.query('select public.export_crm_contact($1,$2) as result',[ids.a,lead.crm_contact_id])).rows[0].result
  expect(exported.contact.email).toBe('privacy@example.test')
  expect(exported.requests[0].message).toBe('Sensitive request')
  expect(exported.activities).toHaveLength(2)

  const request='30000000-0000-4000-8000-000000000001'
  const erased=(await db.query('select public.anonymize_crm_contact($1,$2,$3) as result',[ids.a,lead.crm_contact_id,request])).rows[0].result
  expect(erased).toMatchObject({anonymized:true,already_applied:false,lead_count:1,activity_count:2})
  const retried=(await db.query('select public.anonymize_crm_contact($1,$2,$3) as result',[ids.a,lead.crm_contact_id,request])).rows[0].result
  expect(retried).toMatchObject({anonymized:true,already_applied:true})
  const after=(await db.query('select name,email,phone,message,notes,source_campaign,consent_given,crm_contact_id,crm_match_state from public.lead where id=$1',[lead.id])).rows[0]
  expect(after).toMatchObject({name:'Contacto anonimizado',email:null,phone:null,message:null,notes:null,source_campaign:null,consent_given:false,crm_contact_id:null,crm_match_state:'anonymized'})
  expect((await db.query('select id from public.crm_contacts where id=$1',[lead.crm_contact_id])).rows).toHaveLength(0)
  expect((await db.query('select id from public.crm_activities where contact_id=$1',[lead.crm_contact_id])).rows).toHaveLength(0)
  expect((await db.query('select id,document from public.invoices where id=$1',[savedInvoice.id])).rows[0].document.customer.name).toBe('Client')
})

it('links billing documents explicitly within the tenant and includes them in the contact export',async()=>{
  const lead=await insertLead(ids.a,{name:'Billing contact',email:'billing@example.test'})
  const invoice=await save(db,ids.a,document(),'issued')
  const quote=await save(db,ids.a,document(),'sent','quote')
  await db.exec('reset role')
  const {rows:[invoiceB]}=await db.query("insert into public.invoices(company_id,number,status,document) values($1,'F-OTHER','issued',$2::jsonb) returning id",[ids.b,JSON.stringify(document())])
  await login(db,'editor')
  await db.query('select public.link_crm_billing_document($1,$2,$3,$4)',[ids.a,lead.crm_contact_id,'invoice',invoice.id])
  await db.query('select public.link_crm_billing_document($1,$2,$3,$4)',[ids.a,lead.crm_contact_id,'quote',quote.id])
  await expect(db.query('select public.link_crm_billing_document($1,$2,$3,$4)',[ids.a,lead.crm_contact_id,'invoice',invoiceB.id])).rejects.toThrow()
  await login(db,'viewer')
  await expect(db.query('select public.link_crm_billing_document($1,$2,$3,$4)',[ids.a,lead.crm_contact_id,'invoice',invoice.id])).rejects.toThrow('Forbidden')
  await login(db)
  const linked=(await db.query('select document_kind,number from public.list_crm_billing_documents($1,$2) order by document_kind',[ids.a,lead.crm_contact_id])).rows
  expect(linked).toHaveLength(2)
  expect((await db.query('select public.preview_crm_contact_anonymization($1,$2) as result',[ids.a,lead.crm_contact_id])).rows[0].result.billing_document_count).toBe(2)
  const exported=(await db.query('select public.export_crm_contact($1,$2) as result',[ids.a,lead.crm_contact_id])).rows[0].result
  expect(exported.schema_version).toBe(2)
  expect(exported.billing_documents.map(row=>row.kind).sort()).toEqual(['invoice','quote'])
  const anonymized=(await db.query('select public.anonymize_crm_contact($1,$2,$3) as result',[ids.a,lead.crm_contact_id,'30000000-0000-4000-8000-000000000002'])).rows[0].result
  expect(anonymized).toMatchObject({anonymized:true,billing_document_count:2})
  await db.exec('reset role')
  expect((await db.query('select id from public.invoices where id=$1',[invoice.id])).rows).toHaveLength(1)
  expect((await db.query('select id,status from public.quotes where id=$1',[quote.id])).rows[0]).toMatchObject({id:quote.id,status:'sent'})
  expect((await db.query('select id from public.crm_billing_links where company_id=$1',[ids.a])).rows).toHaveLength(0)
})

it('stores company-defined retention review periods and reports due CRM records without deleting them',async()=>{
  await login(db,'admin')
  const initial=(await db.query('select public.get_crm_retention_review($1) as result',[ids.a])).rows[0].result
  expect(initial).toMatchObject({unresolved_lead_days:null,inactive_contact_days:null,unresolved_leads_for_review:0,inactive_contacts_for_review:0})

  const review=await insertLead(ids.a,{email:'retention-review@example.test'})
  await db.exec('reset role')
  await db.query("update public.lead set crm_match_state='review_required',crm_contact_id=null,created_at=now()-interval '40 days' where id=$1",[review.id])
  await db.query("insert into public.crm_contacts(company_id,name,created_at) values($1,'Contacto antiguo',now()-interval '40 days'),($1,'Contacto con seguimiento',now()-interval '40 days')",[ids.a])
  await db.query("update public.crm_contacts set next_follow_up_at=now()+interval '3 days' where company_id=$1 and name='Contacto con seguimiento'",[ids.a])
  await db.query("insert into public.crm_contacts(company_id,name,created_at) values($1,'Otra empresa antigua',now()-interval '90 days')",[ids.b])
  await login(db,'admin')
  const saved=(await db.query('select public.save_crm_retention_review_settings($1,30,30) as result',[ids.a])).rows[0].result
  expect(saved).toMatchObject({unresolved_lead_days:30,inactive_contact_days:30,unresolved_leads_for_review:1,inactive_contacts_for_review:1})
  await expect(db.query('select public.save_crm_retention_review_settings($1,0,3651)',[ids.a])).rejects.toThrow()

  await login(db,'viewer')
  await expect(db.query('select public.get_crm_retention_review($1)',[ids.a])).rejects.toThrow('Forbidden')
  await expect(db.query('select public.get_crm_retention_review($1)',[ids.b])).rejects.toThrow('Forbidden')
  await expect(db.query('select public.save_crm_retention_review_settings($1,30,30)',[ids.a])).rejects.toThrow('Forbidden')
  await expect(db.query('select * from public.crm_retention_review_settings')).rejects.toThrow()
  expect((await db.query("select id from public.crm_contacts where company_id=$1 and name in ('Contacto antiguo','Contacto con seguimiento')",[ids.a])).rows).toHaveLength(2)
  expect((await db.query('select crm_match_state from public.lead where id=$1',[review.id])).rows[0].crm_match_state).toBe('review_required')
})
