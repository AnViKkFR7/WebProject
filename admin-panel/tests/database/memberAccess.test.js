import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { database, login, ids, sqlFile, save, document } from './helpers'

describe('company member access isolation', () => {
  let db
  beforeAll(async () => {
    db = await database()
    await db.exec(`alter table auth.users add column raw_app_meta_data jsonb default '{}';
      alter table public.company_members add column full_name text default '', add column phone text default '';
      alter table public.company_members enable row level security;
      create policy member_read on public.company_members for select to authenticated using(public.is_company_member(company_id) or public.is_platform_admin());
      create policy old_permissive on public.company_members for all to authenticated using(true) with check(true);
      grant select,update,delete on public.company_members to authenticated;`)
    await db.query('update public.company_members set role=$1 where company_id=$2 and user_id=$3',['admin',ids.a,ids.editor])
    await db.query("update auth.users set raw_app_meta_data='{\"app_role\":\"admin\"}'::jsonb where id=$1",[ids.admin])
    await db.query('insert into public.company_members(company_id,user_id,role) values($1,$2,$3)',[ids.a,ids.admin,'viewer'])
    await db.exec(await sqlFile('migrations/COMPANY_MEMBER_ACCESS.sql'))
    await login(db,'dual'); await save(db)
  },30000)
  afterAll(async () => { await db?.close() })
  const action = (company,user,operation) => db.query('select public.manage_company_member($1,$2,$3)',[company,user,operation])
  it('rejects editors, viewers and admins of a different company', async () => {
    for (const user of ['dual','viewer','editorB','outsider']) {
      await login(db,user)
      await expect(action(ids.a,ids.viewer,'suspend')).rejects.toThrow('administrator')
    }
    await login(db,'editor')
    await expect(action(ids.b,ids.editorB,'remove')).rejects.toThrow('administrator')
  })
  it('suspends access in one company only, including existing invoice permissions', async () => {
    await login(db,'editor'); await action(ids.a,ids.dual,'suspend')
    await login(db,'dual')
    expect((await db.query('select public.is_company_member($1) a,public.is_company_member($2) b',[ids.a,ids.b])).rows[0]).toEqual({a:false,b:true})
    expect((await db.query('select * from public.invoices where company_id=$1',[ids.a])).rows).toHaveLength(0)
    await expect(save(db,ids.a,document())).rejects.toThrow()
    await expect(save(db,ids.b,document())).resolves.toBeTruthy()
    await login(db,'editor'); await action(ids.a,ids.dual,'reactivate')
    await login(db,'dual')
    expect((await db.query('select public.is_company_member($1) allowed',[ids.a])).rows[0].allowed).toBe(true)
  })
  it('protects self access and last active administrator even for platform admins', async () => {
    await login(db,'editor')
    await expect(action(ids.a,ids.editor,'suspend')).rejects.toThrow('own access')
    await expect(action(ids.a,ids.editor,'remove')).rejects.toThrow('own access')
    await login(db,'admin')
    await expect(action(ids.a,ids.editor,'remove')).rejects.toThrow('active company administrator')
    await expect(db.query('select public.update_company_member($1,$2,$3,$4,$5)',[ids.a,ids.editor,'Name','','viewer'])).rejects.toThrow('active company administrator')
  })
  it('protects platform admins and rejects suspended company admins with an existing session', async () => {
    await login(db,'editor')
    await expect(action(ids.a,ids.admin,'remove')).rejects.toThrow('Platform administrators')
    await db.exec('reset role')
    await db.query("update public.company_members set role='admin',is_active=false where company_id=$1 and user_id=$2",[ids.a,ids.dual])
    await login(db,'dual')
    await expect(action(ids.a,ids.viewer,'remove')).rejects.toThrow('administrator')
    await login(db,'editor'); await action(ids.a,ids.dual,'reactivate')
  })
  it('blocks REST bypass of removal, activation, role escalation and tenant moves', async () => {
    await login(db,'dual')
    for (const statement of [
      "update public.company_members set is_active=false where user_id=$1",
      "update public.company_members set role='admin' where user_id=$1",
      `update public.company_members set company_id='${ids.b}' where user_id=$1 and company_id='${ids.a}'`,
      'delete from public.company_members where user_id=$1',
    ]) await expect(db.query(statement,[ids.viewer])).rejects.toThrow()
  })
  it('checks target membership and action, and safely updates a tenant profile', async () => {
    await login(db,'editor')
    await expect(action(ids.a,ids.editorB,'remove')).rejects.toThrow('not found')
    await expect(action(ids.a,ids.viewer,'destroy')).rejects.toThrow('Invalid action')
    await db.query('select public.update_company_member($1,$2,$3,$4,$5)',[ids.a,ids.viewer,'Viewer renamed','123','editor'])
    expect((await db.query('select full_name,role from public.company_members where user_id=$1',[ids.viewer])).rows[0]).toEqual({ full_name:'Viewer renamed',role:'editor' })
  })
  it('removes only the selected membership and preserves authored documents and the auth account', async () => {
    await login(db,'editor'); await action(ids.a,ids.dual,'remove')
    expect((await db.query('select count(*)::int n from public.invoices where company_id=$1',[ids.a])).rows[0].n).toBe(1)
    await login(db,'dual')
    expect((await db.query('select public.is_company_member($1) a,public.is_company_member($2) b',[ids.a,ids.b])).rows[0]).toEqual({a:false,b:true})
    await db.exec('reset role')
    expect((await db.query('select count(*)::int n from auth.users where id=$1',[ids.dual])).rows[0].n).toBe(1)
  })
})
