import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db,original
const save=async(company=ids.a,id=null,name='Shared client')=>(await db.query("select * from public.save_client_company($1,$2,$3,'B123','Madrid','client@example.test','600000000','Ana','#1976d2')",[company,id,name])).rows[0]
const clients=async()=> (await db.query('select * from public.client_company')).rows
async function modules(planning,billing){
  await db.exec('reset role')
  await db.query("update public.company_modules set is_enabled=case when module_key='planning' then $1::boolean else $2::boolean end where company_id=$3",[planning,billing,ids.a])
  await login(db)
}
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DIRECTORY_CATALOG.sql','PLANNING_TENANT_HARDENING.sql'])await db.exec(await sqlFile('migrations/'+file))
  const members=await sqlFile('migrations/COMPANY_MEMBER_ACCESS.sql')
  await db.exec(members.slice(members.indexOf('create or replace function public.has_company_role'),members.indexOf('-- Sensitive changes')))
  await db.exec('create role service_role;create table public.company_modules(company_id uuid,module_key text,is_enabled boolean)')
  const source=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(source.slice(source.indexOf('create or replace function public.is_company_module_enabled'),source.indexOf('insert into public.company_modules')))
  // Apply the real restrictive policies and trigger body, leaving unrelated
  // module tables out of this directory fixture.
  await db.exec(source.slice(source.indexOf('drop policy if exists client_company_module_gate'),source.indexOf('drop policy if exists planning_task_moves_module_gate')))
  await db.exec(source.slice(source.indexOf('drop policy if exists billing_catalog_items_module_gate'),source.indexOf('drop policy if exists billing_chapter_templates_module_gate')))
  await db.exec(source.slice(source.indexOf('create or replace function public.guard_company_module_write'),source.indexOf('do $$ declare item record')))
  for(const table of ['client_company','planning_task','billing'])await db.exec(`create trigger guard_company_module_write before insert or update or delete on public.${table} for each row execute function public.guard_company_module_write('planning')`)
  await db.query("insert into public.company_modules select c.id,m,true from public.companies c cross join unnest(array['planning','billing']) m")
  // The completed audit guard makes billing mandatory for the old directory RPC.
  const completion=await sqlFile('migrations/COMPANY_MODULES_RPC_COMPLETION.sql')
  await db.exec(completion.slice(completion.indexOf('create or replace function public.assert_billing_access'),completion.indexOf('create or replace function public.assert_crm_privacy_admin')))
  await db.exec('create table public.planner_legacy_files(path text,company_id uuid)')
  await db.exec(completion.slice(completion.indexOf('create or replace function public.can_access_planner_object'),completion.indexOf('-- Existing function ACLs')))
  const scope=await sqlFile('migrations/COMPANY_MODULES_SCOPE_FIX.sql')
  await db.exec(scope.slice(scope.indexOf('create or replace function public.assert_company_module_enabled'),scope.indexOf('create or replace function public.get_company_customer_email_settings')))
  await login(db);original=await save()
  await db.query("select public.save_billing_catalog_item($1,null,'Private catalogue','','',10,21)",[ids.a])
  await modules(false,true)
  expect(await clients()).toEqual([])
  await expect(save()).rejects.toThrow('Company module is disabled')
  await modules(true,false);await expect(save()).rejects.toThrow('Company module is disabled')
  await db.exec('reset role');await db.exec(await sqlFile('migrations/CLIENT_DIRECTORY_MODULE_ACCESS.sql'))
},30000)
afterAll(async()=>db?.close())
beforeEach(async()=>{
  await db.exec('reset role;update public.company_members set is_active=true')
  await modules(true,true)
  await db.exec('reset role')
  await db.query('update public.client_company set archived_at=null where id=$1',[original.id])
  await login(db)
})
it.each([[false,true],[true,false],[true,true]])('reads, creates, updates and archives with planning=%s and billing=%s',async(planning,billing)=>{
  await modules(planning,billing)
  expect((await clients()).map(c=>c.id)).toContain(original.id)
  const created=await save();expect(created).toMatchObject({company_id:ids.a,tax_id:'B123',user_id:ids.editor,updated_by:ids.editor})
  expect((await save(ids.a,created.id,'Updated')).name).toBe('Updated')
  await db.query('select public.archive_client_company($1,$2)',[ids.a,created.id])
  expect((await clients()).find(c=>c.id===created.id).archived_at).not.toBeNull()
})
it('hides and blocks the directory when both modules are disabled, including platform admins',async()=>{
  await modules(false,false)
  for(const user of ['editor','admin']){
    await login(db,user)
    expect((await clients()).filter(c=>c.company_id===ids.a)).toEqual([])
    await expect(save()).rejects.toThrow('Company module is disabled')
    await expect(db.query('select public.archive_client_company($1,$2)',[ids.a,original.id])).rejects.toThrow('Company module is disabled')
  }
  await db.exec('reset role')
  await expect(db.query("update public.client_company set name='Bypass' where id=$1",[original.id])).rejects.toThrow('Company module is disabled')
})
it('keeps viewers read-only and suspended members out of both reads and RPCs',async()=>{
  await modules(false,true);await login(db,'viewer')
  expect((await clients()).map(c=>c.id)).toContain(original.id)
  await expect(save()).rejects.toThrow('Forbidden')
  await expect(db.query('select public.archive_client_company($1,$2)',[ids.a,original.id])).rejects.toThrow('Forbidden')
  await db.exec('reset role');await db.query('update public.company_members set is_active=false where company_id=$1 and user_id=$2',[ids.a,ids.editor]);await login(db)
  expect(await clients()).toEqual([]);await expect(save()).rejects.toThrow('Forbidden')
})
it('denies anonymous access, direct writes, tenant spoofing and private helper calls',async()=>{
  await modules(false,true)
  await expect(db.query("update public.client_company set name='Bypass' where id=$1",[original.id])).rejects.toThrow('permission denied')
  await expect(db.exec('truncate public.client_company cascade')).rejects.toThrow('permission denied')
  await expect(db.query('select public.assert_client_directory_access($1)',[ids.a])).rejects.toThrow('permission denied')
  await expect(save(ids.b)).rejects.toThrow('Forbidden')
  for(const user of ['outsider','editorB']){
    await login(db,user)
    expect((await clients()).some(c=>c.company_id===ids.a)).toBe(false)
    await expect(save(ids.a,original.id)).rejects.toThrow('Forbidden')
    await expect(db.query('select public.archive_client_company($1,$2)',[ids.a,original.id])).rejects.toThrow('Forbidden')
  }
  await login(db,'editorB');await expect(save(ids.b,original.id)).rejects.toThrow('Client changed or unavailable')
  await login(db,null,'anon')
  await expect(clients()).rejects.toThrow('permission denied')
  await expect(save()).rejects.toThrow('permission denied')
})
it('keeps Planning rows and writes disabled with billing alone',async()=>{
  await db.exec('reset role')
  await db.query('insert into public.planning_task(company_id,client_company_id) values($1,$2)',[ids.a,original.id])
  await db.query('insert into public.billing(company_id,client_company_id) values($1,$2)',[ids.a,original.id])
  await db.query("insert into public.planner_legacy_files values('legacy.pdf',$1)",[ids.a])
  await modules(false,true)
  for(const user of ['editor','admin']){
    await login(db,user)
    for(const write of [false,true])for(const path of [`${ids.a}/task/file.pdf`,'legacy.pdf'])expect((await db.query('select public.can_access_planner_object($1,$2) ok',[path,write])).rows[0].ok).toBe(false)
  }
  await login(db)
  for(const table of ['planning_task','billing']){
    expect((await db.query(`select * from public.${table}`)).rows).toEqual([])
    await expect(db.query(`insert into public.${table}(company_id) values($1)`,[ids.a])).rejects.toThrow('Company module is disabled')
  }
})
it('does not enable fiscal catalogue writes with Planning alone or cross-tenant task references',async()=>{
  await modules(true,false)
  expect((await db.query('select * from public.billing_catalog_items where company_id=$1',[ids.a])).rows).toEqual([])
  await expect(db.query("select public.save_billing_catalog_item($1,null,'Service','','',10,21)",[ids.a])).rejects.toThrow('Company module is disabled')
  await login(db,'editorB');const foreign=await save(ids.b)
  await login(db)
  await expect(db.query('insert into public.planning_task(company_id,client_company_id) values($1,$2)',[ids.a,foreign.id])).rejects.toThrow('same_tenant')
})
it('retains server validation, archived record protection and platform administration within enabled modules',async()=>{
  await modules(false,true);await login(db,'admin')
  const created=await save()
  await expect(save(ids.a,created.id,'')).rejects.toThrow('Invalid client data')
  await db.query('select public.archive_client_company($1,$2)',[ids.a,created.id])
  await expect(save(ids.a,created.id)).rejects.toThrow('Client changed or unavailable')
  expect((await db.query('select archived_at from public.client_company where id=$1',[created.id])).rows[0].archived_at).not.toBeNull()
})
