import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db,oldAnonymousIds
const draftA='30000000-0000-4000-8000-000000000001',draftB='30000000-0000-4000-8000-000000000002',published='30000000-0000-4000-8000-000000000003'
const summaries=async()=> (await db.query('select * from public.item_media_summary order by item_id')).rows
const visible=async()=> (await summaries()).map(row=>row.item_id)
beforeAll(async()=>{
  db=await database()
  await db.exec(`create table public.items(id uuid primary key,company_id uuid,title text,status text);
    create table public.item_media(id uuid primary key default gen_random_uuid(),item_id uuid references public.items(id),file_type text,url_externa text,alt_text text,sort_order int);
    alter table public.items enable row level security;
    alter table public.item_media enable row level security;
    create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);`)
  const members=await sqlFile('migrations/COMPANY_MEMBER_ACCESS.sql')
  await db.exec(members.slice(members.indexOf('create or replace function public.has_company_role'),members.indexOf('-- Sensitive changes')))
  const base=await sqlFile('schema/DB_SCHEMA.sql')
  await db.exec(base.slice(base.indexOf('-- 9) Policies: items'),base.indexOf('-- 10) Policies:')))
  await db.exec(await sqlFile('schema/ITEM_MEDIA_STORAGE.sql'))
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  await db.exec(modules.slice(modules.indexOf('drop policy if exists items_module_gate'),modules.indexOf('drop policy if exists attribute_definitions_module_gate')))
  await db.exec(modules.slice(modules.indexOf('drop policy if exists item_media_module_gate'),modules.indexOf('drop policy if exists blog_posts_module_gate')))
  await db.query(`insert into public.company_modules values($1,'items',true),($2,'items',true)`,[ids.a,ids.b])
  await db.query(`insert into public.items values($1,$2,'Secret A','draft'),($3,$4,'Secret B','draft'),($5,$4,'Public B','published')`,[draftA,ids.a,draftB,ids.b,published])
  for(const [item,url] of [[draftA,'private-a'],[draftB,'private-b'],[published,'public-b']]) await db.query("insert into public.item_media(item_id,file_type,url_externa,is_cover) values($1,'image',$2,true)",[item,url])
  await login(db,null,'anon');oldAnonymousIds=await visible()
  await db.exec('reset role')
  await db.exec(await sqlFile('migrations/ITEM_MEDIA_SUMMARY_SECURITY.sql'))
})
afterAll(async()=>{await db?.close()})
it('closes the reproduced anonymous leak while retaining published summaries',async()=>{
  expect(oldAnonymousIds).toEqual([draftA,draftB,published])
  await login(db,null,'anon')
  expect(await summaries()).toEqual([expect.objectContaining({item_id:published,item_title:'Public B',cover_url:'public-b',image_count:1,pdf_count:0,cover_count:1})])
})
it('uses the same visibility as items for editors, viewers, outsiders and dual memberships',async()=>{
  for(const [user,expected] of [['editor',[draftA,published]],['viewer',[draftA,published]],['editorB',[draftB,published]],['outsider',[published]],['dual',[draftA,draftB,published]],['admin',[draftA,draftB,published]]]){
    await login(db,user)
    expect(await visible()).toEqual(expected)
    expect((await db.query('select id from public.items order by id')).rows.map(row=>row.id)).toEqual(expected)
  }
})
it('does not reveal guessed draft IDs or cover URLs to outsiders',async()=>{
  await login(db,'outsider')
  expect((await db.query('select * from public.item_media_summary where item_id=$1',[draftB])).rows).toEqual([])
  expect(JSON.stringify(await summaries())).not.toContain('private-')
})
it('removes suspended membership access without hiding published items',async()=>{
  await db.exec('reset role')
  await db.query('update public.company_members set is_active=false where user_id=$1',[ids.editor])
  try {await login(db);expect(await visible()).toEqual([published])}
  finally {await db.exec('reset role');await db.query('update public.company_members set is_active=true where user_id=$1',[ids.editor])}
})
it('honors disabled modules for anonymous, members and platform admins',async()=>{
  await db.exec('reset role')
  await db.query('update public.company_modules set is_enabled=false where company_id=$1',[ids.b])
  try {
    for(const [user,role,expected] of [[null,'anon',[]],['editor','authenticated',[draftA]],['editorB','authenticated',[]],['admin','authenticated',[draftA]]]){
      await login(db,user,role);expect(await visible()).toEqual(expected)
    }
  } finally {await db.exec('reset role');await db.query('update public.company_modules set is_enabled=true where company_id=$1',[ids.b])}
})
it('keeps visible items without media in the cards contract',async()=>{
  await db.exec('reset role')
  const empty='30000000-0000-4000-8000-000000000004'
  await db.query("insert into public.items values($1,$2,'Empty','published')",[empty,ids.a])
  await login(db,null,'anon')
  expect((await db.query('select * from public.item_media_summary where item_id=$1',[empty])).rows).toEqual([expect.objectContaining({item_id:empty,cover_url:null,image_count:0,pdf_count:0,cover_count:0})])
})
