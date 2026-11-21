import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'
let db
const call=(name,args=[])=>db.query(`select * from public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)
async function enabled(module,value){await db.exec('reset role');await db.query('update public.company_modules set is_enabled=$1 where company_id=$2 and module_key=$3',[value,ids.a,module]);await login(db)}
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DRAFTS.sql','BILLING_DIRECTORY_CATALOG.sql','BILLING_CHAPTER_TEMPLATES.sql','BILLING_PAYMENTS_HISTORY.sql','BILLING_ISSUED_INVOICE_LOCK.sql','BILLING_RECTIFYING_INVOICES.sql']) await db.exec(await sqlFile('migrations/'+file))
  const members=await sqlFile('migrations/COMPANY_MEMBER_ACCESS.sql')
  await db.exec(members.slice(members.indexOf('create or replace function public.has_company_role'),members.indexOf('-- Sensitive changes')))
  await db.exec(`create role service_role; create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);
    create table public.planner_legacy_files(path text,company_id uuid);
    create table public.crm_contacts(id uuid,company_id uuid,name text);
    create table public.lead(id uuid,company_id uuid,crm_contact_id uuid,created_at timestamptz);
    create table public.crm_activities(id uuid,company_id uuid,contact_id uuid,occurred_at timestamptz);
    create table public.crm_billing_links(company_id uuid,contact_id uuid,document_kind text,document_id uuid,linked_at timestamptz);
    create table public.planning_email_queue(id uuid,company_id uuid,task_id uuid,status text,occurrence_at timestamptz,last_error_code text,attempt_count int,updated_at timestamptz,delivery_generation int,available_at timestamptz,locked_at timestamptz,provider_message_id text);
    alter table public.planning_task add title text;
    create table public.billing_due_reminder_queue(id uuid,company_id uuid,invoice_id uuid,status text,due_date date,offset_days int,last_error_code text,attempt_count int,updated_at timestamptz,delivery_generation int,available_at timestamptz,locked_at timestamptz,provider_message_id text);`)
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  const scope=await sqlFile('migrations/COMPANY_MODULES_SCOPE_FIX.sql')
  await db.exec(scope.slice(scope.indexOf('create or replace function public.assert_company_module_enabled'),scope.indexOf('create or replace function public.get_company_customer_email_settings')))
  await db.query("insert into public.company_modules select $1,m,true from unnest(array['billing','crm','planning']) m",[ids.a])
  await db.exec(await sqlFile('migrations/COMPANY_MODULES_RPC_COMPLETION.sql'))
  await login(db);await save(db,ids.a,document(),'issued')
},30000)
afterAll(async()=>{await db?.close()})
it('blocks finances and draft recovery when billing is disabled, including platform admins',async()=>{
  await enabled('billing',false)
  for(const user of ['editor','viewer','admin']){
    await login(db,user);await expect(call('get_invoice_financials',[ids.a])).rejects.toThrow('Company module is disabled')
  }
  await login(db);await expect(call('get_billing_draft',[ids.a,'invoice','new'])).rejects.toThrow('Company module is disabled')
  await expect(save(db)).rejects.toThrow('Company module is disabled')
  await enabled('billing',true)
})
it('retains financial viewer access, draft author isolation and tenant denials',async()=>{
  await login(db,'viewer');expect((await call('get_invoice_financials',[ids.a])).rows).toHaveLength(1)
  await expect(call('get_billing_draft',[ids.a,'invoice','new'])).rejects.toThrow('Forbidden')
  for(const user of ['outsider','editorB']){await login(db,user);await expect(call('get_invoice_financials',[ids.a])).rejects.toThrow('Forbidden')}
  await login(db);expect((await call('get_billing_draft',[ids.a,'invoice','new'])).rows[0].get_billing_draft).toBeNull()
  await call('save_billing_draft',[ids.a,'invoice','new',JSON.stringify(document()),null,0,ids.outsider])
  expect((await call('get_billing_draft',[ids.a,'invoice','new'])).rows[0].get_billing_draft.owner_id).toBe(ids.editor)
  await login(db,'dual');expect((await call('get_billing_draft',[ids.a,'invoice','new'])).rows[0].get_billing_draft).toBeNull()
})
it('blocks failure listings and retries by module while preserving enabled queries',async()=>{
  for(const [module,list,retry] of [['billing','list_billing_due_reminder_failures','retry_billing_due_reminder'],['planning','list_planning_email_failures','retry_planning_email']]){
    await enabled(module,false)
    await expect(call(list,[ids.a])).rejects.toThrow('Company module is disabled')
    await expect(call(retry,[ids.a,ids.outsider])).rejects.toThrow('Company module is disabled')
    await enabled(module,true)
    expect((await call(list,[ids.a])).rows).toEqual([])
    expect(Object.values((await call(retry,[ids.a,ids.outsider])).rows[0])).toEqual([false])
  }
})
it('requires CRM admin authorization and an enabled CRM for privacy tools',async()=>{
  await enabled('crm',false);await login(db,'admin')
  await expect(call('assert_crm_privacy_admin',[ids.a])).rejects.toThrow('Company module is disabled')
  await enabled('crm',true);await login(db,'admin');await call('assert_crm_privacy_admin',[ids.a])
  await login(db,'viewer');await expect(call('assert_crm_privacy_admin',[ids.a])).rejects.toThrow('Forbidden')
})
it('guards canonical and legacy Planning objects for members and platform admins',async()=>{
  await db.exec('reset role');await db.query("insert into public.planner_legacy_files values('legacy.png',$1)",[ids.a])
  for(const value of [false,true]){
    await enabled('planning',value)
    for(const user of ['editor','admin']){
      await login(db,user)
      for(const name of [`${ids.a}/task/file.png`,'legacy.png']) expect((await call('can_access_planner_object',[name,false])).rows[0].can_access_planner_object).toBe(value)
    }
  }
  await login(db,'outsider');expect((await call('can_access_planner_object',[`${ids.a}/file`,false])).rows[0].can_access_planner_object).toBe(false)
})
it('exports CRM data but explicitly omits billing documents when billing is disabled',async()=>{
  await db.exec('reset role')
  await db.query("insert into public.crm_contacts values($1,$2,'Contact A')",[ids.outsider,ids.a])
  await db.query("insert into public.crm_billing_links select company_id,$1,'invoice',id,now() from public.invoices where company_id=$2",[ids.outsider,ids.a])
  await login(db,'admin')
  expect((await call('export_crm_contact',[ids.a,ids.outsider])).rows[0].export_crm_contact.billing_documents).toHaveLength(1)
  await enabled('billing',false);await login(db,'admin')
  expect((await call('export_crm_contact',[ids.a,ids.outsider])).rows[0].export_crm_contact).toMatchObject({contact:{name:'Contact A'},billing_documents:[],billing_module_enabled:false})
  await enabled('billing',true)
})
