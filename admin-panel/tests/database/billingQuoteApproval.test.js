import { afterAll,beforeAll,expect,it } from 'vitest'
import { createHash } from 'node:crypto'
import { database,document,ids,login,save,sqlFile } from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  await db.exec('create role service_role')
  await db.exec("alter table auth.users add column email text default null; alter table public.companies add column name text default ''")
  await db.exec(await sqlFile('migrations/BILLING_QUOTE_APPROVAL.sql'))
  await db.exec(await sqlFile('migrations/BILLING_QUOTE_APPROVAL.sql'))
  await db.exec(await sqlFile('migrations/BILLING_QUOTE_APPROVAL_REVISIONS.sql'))
  await db.exec(await sqlFile('migrations/BILLING_QUOTE_APPROVAL_REVISIONS.sql'))
  await login(db)
},30000)
afterAll(async()=>db?.close())

const sentQuote=async(company=ids.a)=>save(db,company,document(),'sent','quote')
const token=n=>String(n).repeat(64)
const issue=async(quote,hash,days=30)=>db.query('select public.issue_quote_approval_link($1,$2,$3,now()+$4::interval)',[ids.a,quote.id,hash,`${days} days`])

it('issues a single-use private link and records an acceptance with declared identity',async()=>{
  const quote=await sentQuote()
  await issue(quote,token(1))
  const details=(await db.query('select public.get_quote_approval_details($1) as value',[token(1)])).rows[0].value
  expect(details).toMatchObject({number:quote.number,status:'sent',document:{customer:{name:'Client'}}})
  await db.exec('set role anon')
  const result=(await db.query("select public.respond_to_quote_approval($1,'accepted','Ana Cliente','ana@example.test',null) as value",[token(1)])).rows[0].value
  expect(result).toMatchObject({already_responded:false,decision:'accepted'})
  await db.exec('reset role')
  expect((await db.query('select status from public.quotes where id=$1',[quote.id])).rows[0].status).toBe('accepted')
  const retried=(await db.query("select public.respond_to_quote_approval($1,'rejected','Otra Persona','other@example.test',null) as value",[token(1)])).rows[0].value
  expect(retried).toMatchObject({already_responded:true,decision:'accepted'})
  await login(db)
  const audit=(await db.query('select public.get_quote_approval_audit($1,$2) as value',[ids.a,quote.id])).rows[0].value
  expect(audit.response).toMatchObject({decision:'accepted',declared_name:'Ana Cliente',declared_email:'ana@example.test'})
  expect(audit.links[0].resolved_at).toBeTruthy()
})

it('rejects unauthorized link issuance, unsent quotes, invalid responses and cross-tenant access',async()=>{
  const draft=await save(db,ids.a,document(),'draft','quote')
  await expect(issue(draft,token(2))).rejects.toThrow('Only sent quotes')
  const quote=await sentQuote()
  await db.exec('reset role')
  await db.query("update public.company_members set role='viewer' where company_id=$1 and user_id=$2",[ids.a,ids.editor])
  await login(db,'editor')
  await expect(issue(quote,token(3))).rejects.toThrow('Forbidden')
  await db.exec('reset role')
  await db.query("update public.company_members set role='editor' where company_id=$1 and user_id=$2",[ids.a,ids.editor])
  await login(db,'editorB')
  const foreign=await sentQuote(ids.b)
  await login(db)
  await expect(db.query('select public.issue_quote_approval_link($1,$2,$3,now()+interval \'30 days\')',[ids.a,foreign.id,token(4)])).rejects.toThrow('Only sent quotes')
  await issue(quote,token(5))
  await db.exec('set role anon')
  await expect(db.query("select public.respond_to_quote_approval($1,'accepted','Ana Cliente','invalid',null)",[token(5)])).rejects.toThrow('valid email')
  await expect(db.query("select public.respond_to_quote_approval($1,'accepted','Ana Cliente','a@example.test',null)",[token(6)])).rejects.toThrow('expired or unavailable')
  await db.exec('reset role')
  await login(db)
})

it('revokes earlier links on reissue and refuses expired ones',async()=>{
  const quote=await sentQuote()
  await issue(quote,token(7))
  await issue(quote,token(8))
  expect((await db.query('select public.get_quote_approval_details($1) as value',[token(7)])).rows[0].value).toBeNull()
  expect((await db.query('select public.get_quote_approval_details($1) as value',[token(8)])).rows[0].value.status).toBe('sent')
  await db.exec('reset role')
  await db.query('update public.quote_approval_links set expires_at=now()-interval \'1 minute\' where token_hash=$1',[token(8)])
  await db.exec('set role anon')
  expect((await db.query('select public.get_quote_approval_details($1) as value',[token(8)])).rows[0].value).toBeNull()
  await expect(db.query("select public.respond_to_quote_approval($1,'accepted','Ana Cliente','a@example.test',null)",[token(8)])).rejects.toThrow('expired or unavailable')
  await db.exec('reset role')
  await login(db)
})

it('revokes an outstanding link when the quote content changes or closes',async()=>{
  const quote=await sentQuote()
  await issue(quote,token(9))
  await db.exec('reset role')
  await db.query("update public.quotes set document=document||'{\"notes\":\"revised\"}'::jsonb,version=version+1 where id=$1",[quote.id])
  await login(db)
  expect((await db.query('select public.get_quote_approval_details($1) as value',[token(9)])).rows[0].value).toBeNull()
  await issue(quote,token('a'))
  await db.exec('reset role')
  await db.query("update public.quotes set status='cancelled',version=version+1 where id=$1",[quote.id])
  await login(db)
  expect((await db.query('select public.get_quote_approval_details($1) as value',[token('a')])).rows[0].value).toBeNull()
})

it('allows a revised quote to be accepted after an earlier rejection and preserves both responses',async()=>{
  const quote=await sentQuote()
  await issue(quote,token('b'))
  await db.exec('set role anon')
  await db.query("select public.respond_to_quote_approval($1,'rejected','Ana Cliente','ana@example.test','Plazo')",[token('b')])
  await db.exec('reset role')
  await login(db)
  const saved=(await db.query('select document,version from public.quotes where id=$1',[quote.id])).rows[0]
  await db.query("select public.save_quote($1,$2::jsonb,'sent',$3,$4)",[ids.a,JSON.stringify({...saved.document,notes:'revisado'}),quote.id,saved.version])
  expect((await db.query('select status from public.quotes where id=$1',[quote.id])).rows[0].status).toBe('sent')
  await issue(quote,token('c'))
  await db.exec('set role anon')
  const result=(await db.query("select public.respond_to_quote_approval($1,'accepted','Ana Cliente','ana@example.test',null) as value",[token('c')])).rows[0].value
  expect(result).toMatchObject({already_responded:false,decision:'accepted'})
  await db.exec('reset role')
  await login(db)
  expect((await db.query('select status from public.quotes where id=$1',[quote.id])).rows[0].status).toBe('accepted')
  const audit=(await db.query('select public.get_quote_approval_audit($1,$2) as value',[ids.a,quote.id])).rows[0].value
  expect(audit.response.decision).toBe('accepted')
  expect(audit.responses.map(row=>row.decision).sort()).toEqual(['accepted','rejected'])
  expect(audit.quote_status).toBe('accepted')
})

it('limits quote emails to the authorized company team and exposes only the minimum notification payload',async()=>{
  await db.exec('reset role')
  await db.query("insert into public.company_members(company_id,user_id,role,is_active) values($1,$2,'admin',true)",[ids.a,ids.admin])
  await db.query("update auth.users set email='owner@example.test' where id=$1",[ids.admin])
  await login(db,'admin')
  const payload={...document(),customer:{...document().customer,email:'client@example.test'}}
  const quote=await save(db,ids.a,payload,'sent','quote')
  const rawToken=token('d'),hash=createHash('sha256').update(rawToken).digest('hex')
  await issue(quote,hash)
  const email=(await db.query('select public.get_quote_approval_email_payload($1,$2,$3,$4) as value',[ids.admin,ids.a,quote.id,hash])).rows[0].value
  expect(email).toMatchObject({recipient_email:'client@example.test',quote_number:quote.number,link_id:expect.any(String)})
  await db.query("select public.respond_to_quote_approval($1,'accepted','Cliente','client@example.test',null)",[hash])
  await db.exec('set role service_role')
  const notice=(await db.query('select public.get_quote_approval_notification_payload($1) as value',[hash])).rows[0].value
  expect(notice).toMatchObject({quote_id:quote.id,decision:'accepted',customer_email:'client@example.test',response_id:expect.any(String)})
  expect(notice.recipient_emails).toEqual(['owner@example.test'])
  expect((await db.query('select public.mark_quote_approval_notification_sent($1,$2) as sent',[notice.link_id,'resend_test'])).rows[0].sent).toBe(true)
  expect((await db.query('select public.get_quote_approval_notification_payload($1) as value',[hash])).rows[0].value.already_notified).toBe(true)
  await db.exec('reset role')
  await login(db,'admin')
})

it('reports a complete, safely permissioned quote approval installation in the read-only preflight',async()=>{
  const preflight=await sqlFile('maintenance/BILLING_QUOTE_APPROVAL_PREFLIGHT.sql')
  const {rows:[status]}=await db.query(preflight)
  expect(status).toEqual({
    quotes_table_exists:true,
    approval_links_table_exists:true,
    approval_responses_table_exists:true,
    required_columns_present:true,
    quote_tenant_key_index_exists:true,
    single_active_link_index_exists:true,
    expiry_index_exists:true,
    quote_link_revocation_trigger_exists:true,
    quote_link_email_tracking_columns_present:true,
    response_notification_tracking_columns_present:true,
    required_functions_present:true,
    rpc_security_definer_enabled:true,
    rls_enabled_on_private_tables:true,
    direct_table_access_revoked:true,
    rpc_grants_match_expected_roles:true,
  })
})
