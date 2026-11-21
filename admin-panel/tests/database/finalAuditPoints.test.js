import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest'
import {fullApplication} from './fullApplication'
import {document,ids,login,save} from './helpers'
let db
const uuid=()=>crypto.randomUUID()
const pay=async(invoice,amount)=>{
 const current=(await db.query('select version from public.invoices where id=$1',[invoice.id])).rows[0]
 return(await db.query("select public.register_invoice_payment($1,$2,$3,$4,$5,current_date,'bank','') row",[ids.a,invoice.id,current.version,uuid(),amount])).rows[0].row
}
const issuedCount=async()=>(await db.query("select public.weekly_summary_issued_count($1,now()-interval '1 day',now()+interval '1 day') n",[ids.a])).rows[0].n
const overdueCount=async()=>(await db.query('select public.weekly_summary_overdue_count($1,current_date) n',[ids.a])).rows[0].n
const search=async(query,company=ids.a)=>(await db.query('select * from public.list_crm_privacy_contacts($1,$2)',[company,query])).rows
const claim=async(email='new@example.test',resend=false,company=ids.a,actor=ids.admin)=>(await db.query("select public.claim_company_user_invitation($1,$2,$3,'New User','viewer',$4) job",[actor,company,email,resend])).rows[0].job
const attach=async(job,user=null)=>(await db.query('select public.attach_company_user_invitation($1,$2,$3) state',[job.id,job.token,user])).rows[0].state
const finish=async(job,delivery)=>(await db.query('select public.finish_company_user_invitation($1,$2,$3) ok',[job.id,job.token,delivery])).rows[0].ok
beforeAll(async()=>{db=await fullApplication({watch:true})},60000)
afterAll(async()=>db?.close())
beforeEach(async()=>{
 await db.exec('reset role;truncate public.billing_document_events,public.invoices,public.crm_contacts,public.planning_task,public.company_weekly_summary_queue,public.company_user_invitations cascade;update public.company_modules set is_enabled=true;update public.company_members set is_active=true')
})
it('counts created-issued and edited-then-issued invoices once, excluding payments and metadata',async()=>{
 await login(db)
 const first=await save(db,ids.a,document(),'issued')
 const draft=await save(db)
 const changed=document();changed.notes='Edited while issuing'
 await save(db,ids.a,changed,'issued','invoice',draft)
 const payment=await pay(first,20)
 await db.query("select public.reverse_invoice_payment($1,$2,$3,'Reversal')",[ids.a,payment.id,uuid()])
 await db.exec('reset role')
 expect(await issuedCount()).toBe(2)
 // A later transition for the same record must not count as another first issue.
 await db.query("insert into public.billing_document_events(company_id,kind,record_id,action,version,snapshot,changes) values($1,'invoice',$2,'status_changed',99,'{}','{\"status_before\":\"draft\",\"status_after\":\"issued\"}')",[ids.a,first.id])
 expect(await issuedCount()).toBe(2)
 await db.query("update public.billing_document_events set created_at=now()-interval '3 days' where record_id=$1 and action='created'",[first.id])
 expect(await issuedCount()).toBe(1)
})
it('does not invent an issuance date from an already-issued historical baseline',async()=>{
 const record=uuid()
 await db.query("insert into public.billing_document_events(company_id,kind,record_id,action,version,snapshot,changes) values($1,'invoice',$2,'baseline',1,'{\"status\":\"issued\"}','{}'),($1,'invoice',$2,'status_changed',2,'{}','{\"status_before\":\"draft\",\"status_after\":\"issued\"}')",[ids.a,record])
 expect(await issuedCount()).toBe(0)
})
it('returns corrected normal payload counts and zeros disabled modules',async()=>{
 const doc=document();doc.date='2020-01-01';doc.dueDate='2020-02-01'
 await login(db)
 const invoice=await save(db,ids.a,doc,'issued');await pay(invoice,121)
 await db.query("insert into public.planning_task(company_id,title,start_datetime,recurrence_type,recurrence_value) values($1,'Old daily series','2020-01-01 09:00+01','daily',1)",[ids.a])
 await db.exec('reset role')
 const week=(await db.query("select (date_trunc('week',now() at time zone 'Europe/Madrid')::date-7)::text d")).rows[0].d
 await db.query("update public.billing_document_events set created_at=($1::date+1)::timestamp at time zone 'Europe/Madrid' where record_id=$2 and action='created'",[week,invoice.id])
 await db.query('insert into public.company_weekly_summary_queue(company_id,week_start) values($1,$2)',[ids.a,week])
 const job=(await db.query('select * from public.claim_company_weekly_summary_batch(1)')).rows[0]
 const payload=async()=>(await db.query('select * from public.get_company_weekly_summary_payload($1)',[job.queue_id])).rows[0]
 expect(await payload()).toMatchObject({issued_invoices:1,overdue_invoices:0,upcoming_planning:7})
 await db.query("update public.company_modules set is_enabled=false where company_id=$1 and module_key in('billing','planning')",[ids.a])
 expect(await payload()).toMatchObject({issued_invoices:0,overdue_invoices:0,upcoming_planning:0})
})
it('counts only outstanding current invoice families, accounting for payment reversal and substitutions',async()=>{
 const doc=document();doc.date='2020-01-01';doc.dueDate='2020-02-01'
 await login(db)
 const paid=await save(db,ids.a,doc,'issued'),partial=await save(db,ids.a,doc,'issued'),original=await save(db,ids.a,doc,'issued')
 const payment=await pay(paid,121);await pay(partial,10)
 await db.query("select public.rectify_invoice($1,$2,$3,'substitution','other','Replacement',$4)",[ids.a,original.id,doc,uuid()])
 await db.exec('reset role');expect(await overdueCount()).toBe(2)
 await login(db);await db.query("select public.reverse_invoice_payment($1,$2,$3,'Reversal')",[ids.a,payment.id,uuid()])
 await db.exec('reset role');expect(await overdueCount()).toBe(3)
})
it('counts real recurrence occurrences in a Madrid week including old series and end boundaries',async()=>{
 await login(db)
 for(const [company,start,type,value] of [[ids.a,'2020-01-01 09:00+01','daily',1],[ids.a,'2026-10-26 09:00+01','none',null],[ids.a,'2026-11-02 00:00+01','none',null],[ids.b,'2026-10-26 09:00+01','none',null]]){
  await db.exec('reset role')
  await db.query("insert into public.planning_task(company_id,title,start_datetime,recurrence_type,recurrence_value) values($1,'Task',$2,$3,$4)",[company,start,type,value])
 }
 expect((await db.query("select public.weekly_summary_planning_count($1,'2026-10-26 00:00+01','2026-11-02 00:00+01') n",[ids.a])).rows[0].n).toBe(8)
 expect((await db.query("select public.weekly_summary_planning_count($1,'2026-10-19 00:00+02','2026-10-26 00:00+01') n",[ids.a])).rows[0].n).toBe(7)
})
it('updates the optional Watch metrics without activating a test or losing the normal retry guard',async()=>{
 const definition=(await db.query("select pg_get_functiondef('public.get_watch_weekly_summary_test_payload(uuid)'::regprocedure) definition")).rows[0].definition
 expect(definition).toContain('weekly_summary_issued_count');expect(definition).toContain('weekly_summary_planning_count')
 expect((await db.query('select count(*)::int n from public.company_weekly_summary_watch_test')).rows[0].n).toBe(0)
 expect((await db.query("select pg_get_functiondef('public.get_company_weekly_summary_payload(uuid)'::regprocedure) definition")).rows[0].definition).toContain("first_attempt_at>now()-interval '20 hours'")
})
it('searches letters and punctuation literally, without turning an empty phone pattern into all contacts',async()=>{
 for(const [company,name,email,phone] of [[ids.a,'Ana 100%_safe','ana@example.test','+34 612 345 678'],[ids.a,'Beto','beto@example.test','600000000'],[ids.b,'Ana foreign','ana@example.test','612345678']])await db.query('insert into public.crm_contacts(company_id,name,email,phone) values($1,$2,$3,$4)',[company,name,email,phone])
 await login(db,'admin')
 expect((await search('Ana')).map(c=>c.name)).toEqual(['Ana 100%_safe'])
 expect(await search('nothing')).toEqual([])
 expect((await search('%_')).map(c=>c.name)).toEqual(['Ana 100%_safe'])
 expect(await search('\\_')).toEqual([])
 expect((await search('+34 612')).map(c=>c.name)).toEqual(['Ana 100%_safe'])
 expect(await search('person612')).toEqual([])
 expect(await search('  ')).toEqual([])
})
it('requires active CRM administrator authorization and denies foreign-company or browser metric calls',async()=>{
 for(const user of ['editor','viewer','editorB']){
  await login(db,user);await expect(search('Ana')).rejects.toThrow('Forbidden')
 }
 await db.exec('reset role');await db.query("update public.company_members set role='admin',is_active=false where company_id=$1 and user_id=$2",[ids.a,ids.editor]);await login(db)
 await expect(search('Ana')).rejects.toThrow('Forbidden')
 await db.exec('reset role');await db.query("update public.company_members set role='admin',is_active=true where company_id=$1 and user_id=$2",[ids.a,ids.editor]);await login(db)
 await expect(search('Ana',ids.b)).rejects.toThrow('Forbidden')
 await db.exec('reset role');await db.query("update public.company_modules set is_enabled=false where company_id=$1 and module_key='crm'",[ids.a]);await login(db,'admin')
 await expect(search('Ana')).rejects.toThrow('Company module is disabled')
 await expect(issuedCount()).rejects.toThrow('permission denied')
})
it('serializes invitation attempts and preserves one user/membership across failures and retries',async()=>{
 const email=uuid()+'@example.test',job=await claim(email),user=uuid()
 await expect(claim(email)).rejects.toThrow('Invitation in progress')
 await db.query('insert into auth.users(id,email) values($1,$2)',[user,email])
 const state=await attach(job,user);expect(state).toMatchObject({ready:true,user_id:user,confirmed:false,role:'viewer'})
 expect(await finish(job,'failed')).toBe(true)
 expect(await claim(email)).toMatchObject({can_send:false,user_id:user,delivery:'failed',membership:true})
 await expect(claim(email,true)).rejects.toThrow('Invitation cooldown')
 await db.query("update public.company_user_invitations set last_attempt_at=now()-interval '2 minutes' where id=$1",[job.id])
 const retry=await claim(email,true)
 expect(retry.user_id).toBe(user);expect((await attach(retry,user)).ready).toBe(true)
 expect((await db.query('select count(*)::int n from public.company_members where company_id=$1 and user_id=$2',[ids.a,user])).rows[0].n).toBe(1)
 expect(await finish(job,'accepted')).toBe(false)
 expect(await finish(retry,'accepted')).toBe(true)
 expect(await claim(email)).toMatchObject({can_send:false,delivery:'accepted'})
 await db.query("update public.company_user_invitations set last_attempt_at=now()-interval '2 minutes' where id=$1",[job.id])
 expect(await claim(email,true)).toMatchObject({can_send:true,user_id:user})
})
it('recovers ambiguous creation by email and preserves existing membership roles and suspensions',async()=>{
 const email=uuid()+'@example.test',user=uuid()
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,email])
 await db.query("insert into public.company_members(company_id,user_id,role,full_name) values($1,$2,'editor','Original')",[ids.a,user])
 const job=await claim(email)
 expect(await attach(job)).toMatchObject({ready:true,user_id:user,confirmed:true,role:'editor'})
 await finish(job,'not_required')
 await db.query('update public.company_members set is_active=false where company_id=$1 and user_id=$2',[ids.a,user])
 await db.query("update public.company_user_invitations set last_attempt_at=now()-interval '2 minutes' where id=$1",[job.id])
 expect(await attach(await claim(email,true))).toMatchObject({ready:false,user_id:user})
 expect((await db.query('select full_name,role,is_active from public.company_members where company_id=$1 and user_id=$2',[ids.a,user])).rows[0]).toEqual({full_name:'Original',role:'editor',is_active:false})
})
it('does not automatically repeat an expired sending attempt and denies browser/unauthorized invitation RPCs',async()=>{
 const email=uuid()+'@example.test',job=await claim(email)
 await db.query("update public.company_user_invitations set locked_at=now()-interval '3 minutes' where id=$1",[job.id])
 expect(await claim(email)).toMatchObject({can_send:false,delivery:'unknown'})
 await expect(claim(email,false,ids.a,ids.editor)).rejects.toThrow('Forbidden')
 for(const [user,role] of [['admin','authenticated'],[null,'anon']]){
  await login(db,user,role);await expect(claim()).rejects.toThrow('permission denied')
  await expect(db.query('select * from public.company_user_invitations')).rejects.toThrow('permission denied')
 }
})
