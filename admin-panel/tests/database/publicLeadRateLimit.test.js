import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db
const key=n=>n.toString(16).padStart(64,'0')
const reserve=async(company=ids.a,client=key(1))=>(await db.query('select public.reserve_public_lead_attempt($1,$2) allowed',[company,client])).rows[0].allowed
beforeAll(async()=>{
  db=await database()
  await db.exec(`create role service_role; create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);`)
  await db.query("insert into public.company_modules values($1,'crm',true),($2,'crm',true)",[ids.a,ids.b])
  await db.exec(await sqlFile('migrations/PUBLIC_LEAD_RATE_LIMIT.sql'))
},30000)
afterAll(async()=>{await db?.close()})
it('allows five attempts and denies subsequent reservations without incrementing counters',async()=>{
  for(let n=0;n<5;n++)expect(await reserve()).toBe(true)
  expect(await reserve()).toBe(false)
  expect((await db.query("select attempts from public.public_lead_rate_buckets where company_id=$1 and scope_key='company'",[ids.a])).rows[0].attempts).toBe(5)
})
it('isolates companies and applies a company-wide cap even when client keys vary',async()=>{
  expect(await reserve(ids.b)).toBe(true)
  for(let n=2;n<=96;n++)expect(await reserve(ids.a,key(n))).toBe(true)
  expect(await reserve(ids.a,key(97))).toBe(false)
  expect((await db.query('select count(*)::int n from public.public_lead_rate_buckets where company_id=$1',[ids.a])).rows[0].n).toBe(97)
})
it('denies browser roles access to the RPC and buckets, while service-role reservations work',async()=>{
  for(const [user,role] of [[null,'anon'],['editor','authenticated'],['admin','authenticated']]){
    await login(db,user,role)
    await expect(reserve()).rejects.toThrow('permission denied')
    await expect(db.query('select * from public.public_lead_rate_buckets')).rejects.toThrow('permission denied')
  }
  await db.exec('reset role;set role service_role')
  expect(await reserve(ids.b,key(2))).toBe(true)
  await expect(db.query('delete from public.public_lead_rate_buckets')).rejects.toThrow('permission denied')
  await db.exec('reset role')
})
it('fails closed for invalid keys and disabled or unconfigured modules',async()=>{
  for(const client of [null,'','x'.repeat(64)])await expect(reserve(ids.b,client)).rejects.toThrow('Invalid reservation')
  await db.query("update public.company_modules set is_enabled=false where company_id=$1",[ids.b])
  await expect(reserve(ids.b)).rejects.toThrow('Requests unavailable')
  await db.query('delete from public.company_modules where company_id=$1',[ids.b])
  await expect(reserve(ids.b)).rejects.toThrow('Requests unavailable')
  await db.query("insert into public.company_modules values($1,'crm',true)",[ids.b])
})
it('purges expired metadata and preserves active windows',async()=>{
  await db.query("insert into public.public_lead_rate_buckets values($1,'company',now()-interval '1 day',1,now()-interval '20 hours')",[ids.b])
  await db.exec('select public.purge_public_lead_rate_buckets()')
  expect((await db.query('select count(*)::int n from public.public_lead_rate_buckets where expires_at<now()')).rows[0].n).toBe(0)
  expect(await reserve(ids.b,key(3))).toBe(true)
})
