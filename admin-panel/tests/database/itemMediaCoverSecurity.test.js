import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db
const itemA='30000000-0000-4000-8000-000000000001',itemB='30000000-0000-4000-8000-000000000002'
const first='40000000-0000-4000-8000-000000000001',second='40000000-0000-4000-8000-000000000002',foreign='40000000-0000-4000-8000-000000000003',pdf='40000000-0000-4000-8000-000000000004'
beforeAll(async()=>{
  db=await database()
  await db.exec(`create table public.items(id uuid primary key,company_id uuid,title text);
    create table public.item_media(id uuid primary key,item_id uuid references public.items(id),file_type text,url_externa text,alt_text text,sort_order int);
    alter table public.item_media enable row level security;
    create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);`)
  const members=await sqlFile('migrations/COMPANY_MEMBER_ACCESS.sql')
  await db.exec(members.slice(members.indexOf('create or replace function public.has_company_role'),members.indexOf('-- Sensitive changes')))
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  await db.exec(await sqlFile('schema/ITEM_MEDIA_STORAGE.sql'))
  await db.exec(await sqlFile('migrations/ITEM_MEDIA_COVER_SECURITY.sql'))
  await db.query(`insert into public.items values($1,$2,'A'),($3,$4,'B')`,[itemA,ids.a,itemB,ids.b])
  await db.query(`insert into public.company_modules values($1,'items',true),($2,'items',true)`,[ids.a,ids.b])
  await db.query(`insert into public.item_media(id,item_id,file_type,alt_text,is_cover) values($1,$2,'image',null,true),($3,$2,'image',null,false),($4,$5,'image',null,true),($6,$2,'pdf','PDF',false)`,[first,itemA,second,foreign,itemB,pdf])
})
afterAll(async()=>{await db?.close()})
const cover=async(item,media)=>db.query('select public.set_item_cover($1,$2)',[item,media])
async function covers(){await db.exec('reset role');return (await db.query('select id from public.item_media where is_cover order by id')).rows.map(row=>row.id)}
it('allows editors and company admins to switch only their own cover',async()=>{
  await login(db);await cover(itemA,second);expect(await covers()).toEqual([second,foreign])
  await db.query("update public.company_members set role='admin' where user_id=$1",[ids.editor])
  await login(db);await cover(itemA,first);expect(await covers()).toEqual([first,foreign])
  await db.query("update public.company_members set role='editor' where user_id=$1",[ids.editor])
})
it('rejects anonymous, viewers, outsiders and members of another company without changing covers',async()=>{
  for(const [user,role] of [[null,'anon'],[null,'authenticated'],['viewer','authenticated'],['outsider','authenticated'],['editorB','authenticated']]){
    await login(db,user,role);await expect(cover(itemA,second)).rejects.toThrow();expect(await covers()).toEqual([first,foreign])
  }
})
it('rejects foreign media even for a dual-company editor, PDF, missing media and null parameters atomically',async()=>{
  for(const [item,media] of [[itemA,foreign],[itemA,pdf],[itemA,ids.outsider],[itemA,null],[null,first]]){
    await login(db,'dual');await expect(cover(item,media)).rejects.toThrow();expect(await covers()).toEqual([first,foreign])
  }
})
it('rejects suspended editors and disabled modules, including platform admins',async()=>{
  await db.query('update public.company_members set is_active=false where user_id=$1',[ids.editor])
  await login(db);await expect(cover(itemA,second)).rejects.toThrow();await covers()
  await db.query('update public.company_members set is_active=true where user_id=$1',[ids.editor])
  await db.query('update public.company_modules set is_enabled=false where company_id=$1',[ids.a])
  for(const user of ['editor','admin']){await login(db,user);await expect(cover(itemA,second)).rejects.toThrow('Company module is disabled');await covers()}
  await db.query('update public.company_modules set is_enabled=true where company_id=$1',[ids.a])
})
it('allows a platform admin and repeated requests while preserving exactly one cover per item',async()=>{
  await login(db,'admin');await cover(itemA,second);await cover(itemA,second);expect(await covers()).toEqual([second,foreign])
})
it('rolls back removal of the previous cover if assigning the new one fails',async()=>{
  await db.exec(`create function public.fail_cover_test() returns trigger language plpgsql as $$ begin if new.is_cover and new.id='${first}' then raise exception 'simulated failure'; end if; return new; end $$;
    create trigger fail_cover_test before update on public.item_media for each row execute function public.fail_cover_test();`)
  try {
    await login(db);await expect(cover(itemA,first)).rejects.toThrow('simulated failure')
    expect(await covers()).toEqual([second,foreign])
  } finally {
    await db.exec('reset role; drop trigger fail_cover_test on public.item_media; drop function public.fail_cover_test()')
  }
})
