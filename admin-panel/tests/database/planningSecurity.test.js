import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { database, ids, login, sqlFile } from './helpers'
let db; let clientA; let clientB
beforeAll(async () => {
  db=await database()
  await db.exec(await sqlFile('migrations/BILLING_SECURITY_HARDENING.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_TENANT_HARDENING.sql'))
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,public boolean default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    insert into storage.buckets values('media-planner',true),('other',true);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
    -- Reproducir una política antigua excesivamente amplia.
    create policy legacy_broad_access on storage.objects for all to public using(true) with check(true);
  `)
  await db.exec(`insert into public.client_company(id,company_id,name) values
    ('30000000-0000-4000-8000-000000000001','${ids.a}','Client A'),
    ('30000000-0000-4000-8000-000000000002','${ids.b}','Client B')`)
  clientA='30000000-0000-4000-8000-000000000001'; clientB='30000000-0000-4000-8000-000000000002'
  await db.query('insert into public.planning_task(company_id,client_company_id,attachments) values ($1,$2,$3)',[ids.a,clientA,JSON.stringify([{ path:'tasks/legacy-secret.pdf' }])])
  await db.query("insert into storage.objects(bucket_id,name) values ('media-planner',$1),('media-planner',$2),('media-planner','tasks/legacy-secret.pdf'),('other','public.txt')",[`${ids.a}/tasks/a.pdf`,`${ids.b}/tasks/b.pdf`])
  await db.exec(await sqlFile('migrations/PLANNING_STORAGE_HARDENING.sql'))
},30000)
afterAll(async () => { await db?.close() })

describe('planning tenant references', () => {
  it('allows clients and tasks within the same company', async () => {
    await login(db)
    expect((await db.query('insert into public.planning_task(company_id,client_company_id) values ($1,$2) returning company_id',[ids.a,clientA])).rows[0].company_id).toBe(ids.a)
  })
  it('rejects a foreign client reference, even for dual membership', async () => {
    await login(db,'dual')
    for (const table of ['planning_task','billing']) await expect(db.query(`insert into public.${table}(company_id,client_company_id) values ($1,$2)`,[ids.a,clientB])).rejects.toThrow('same_tenant')
  })
  it('does not allow records to be moved to another company', async () => {
    await login(db,'dual')
    await expect(db.query('update public.client_company set company_id=$1 where id=$2',[ids.b,clientA])).rejects.toThrow('cannot be changed')
  })
  it('allows tasks without a client but not without a tenant', async () => {
    await login(db)
    expect((await db.query('insert into public.planning_task(company_id) values ($1) returning client_company_id',[ids.a])).rows[0].client_company_id).toBe(null)
    await expect(db.query('insert into public.planning_task(company_id) values (null)')).rejects.toThrow()
  })
})

describe('private planning storage, including broad legacy policies', () => {
  it('makes the planning bucket private', async () => {
    await db.exec('reset role')
    expect((await db.query("select public from storage.buckets where id='media-planner'")).rows[0].public).toBe(false)
  })
  it('lets an editor read own files and legacy files, but no other tenant files', async () => {
    await login(db)
    const files=(await db.query("select name from storage.objects where bucket_id='media-planner' order by name")).rows.map(r=>r.name)
    expect(files).toEqual([`${ids.a}/tasks/a.pdf`,'tasks/legacy-secret.pdf'])
  })
  it('lets viewers read but not write their company attachments', async () => {
    await login(db,'viewer')
    expect((await db.query("select name from storage.objects where bucket_id='media-planner'")).rows.length).toBe(2)
    await expect(db.query("insert into storage.objects(bucket_id,name) values('media-planner',$1)",[`${ids.a}/tasks/viewer.pdf`])).rejects.toThrow('row-level security')
    expect((await db.query("delete from storage.objects where bucket_id='media-planner' returning id")).rows).toEqual([])
  })
  it('prevents foreign company reads, inserts, updates and deletes', async () => {
    await login(db,'editorB')
    expect((await db.query("select name from storage.objects where name='tasks/legacy-secret.pdf'")).rows).toEqual([])
    await expect(db.query("insert into storage.objects(bucket_id,name) values('media-planner',$1)",[`${ids.a}/tasks/attack.pdf`])).rejects.toThrow('row-level security')
    expect((await db.query("delete from storage.objects where name='tasks/legacy-secret.pdf' returning id")).rows).toEqual([])
    await expect(db.query("update storage.objects set name=$1 where name=$2",[`${ids.a}/tasks/moved.pdf`,`${ids.b}/tasks/b.pdf`])).rejects.toThrow('row-level security')
  })
  it('denies anonymous access even with a broad preexisting policy', async () => {
    await login(db,null,'anon')
    expect((await db.query("select name from storage.objects where bucket_id='media-planner'")).rows).toEqual([])
    await expect(db.query("insert into storage.objects(bucket_id,name) values('media-planner','tasks/injected.pdf')")).rejects.toThrow('row-level security')
  })
  it('does not grant access when another tenant forges a legacy attachment reference', async () => {
    await login(db,'editorB')
    await db.query('insert into public.planning_task(company_id,client_company_id,attachments) values ($1,$2,$3)',[ids.b,clientB,JSON.stringify([{ path:'tasks/legacy-secret.pdf' }])])
    expect((await db.query("select name from storage.objects where name='tasks/legacy-secret.pdf'")).rows).toEqual([])
    await expect(db.query('select * from public.planner_legacy_files')).rejects.toThrow('permission denied')
    await db.exec('reset role')
    await db.exec(await sqlFile('migrations/PLANNING_STORAGE_HARDENING.sql'))
    await login(db,'editorB')
    expect((await db.query("select name from storage.objects where name='tasks/legacy-secret.pdf'")).rows).toEqual([])
  })
  it('allows authorized uploads and leaves other buckets unaffected', async () => {
    await login(db)
    expect((await db.query("insert into storage.objects(bucket_id,name) values('media-planner',$1) returning name",[`${ids.a}/tasks/new.pdf`])).rows.length).toBe(1)
    expect((await db.query("select name from storage.objects where bucket_id='other'")).rows).toEqual([{ name:'public.txt' }])
  })
  it('is safe to reapply both migrations', async () => {
    await db.exec('reset role')
    await db.exec(await sqlFile('migrations/PLANNING_TENANT_HARDENING.sql'))
    await db.exec(await sqlFile('migrations/PLANNING_STORAGE_HARDENING.sql'))
    await db.exec(await sqlFile('maintenance/BILLING_SECURITY_AUDIT.sql'))
  })
})
