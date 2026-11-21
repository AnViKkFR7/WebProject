import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
let db
const item='30000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000002'
const media='40000000-0000-4000-8000-000000000001'
const project='https://project.example.test',path=`${ids.a}/${item}/photo.png`
const url=`${project}/storage/v1/object/public/items-media/${path}`
const rows=async()=> (await db.query('select * from public.item_storage_cleanup_queue')).rows
const claim=async()=> (await db.query('select * from public.claim_item_storage_cleanup(20)')).rows[0]
const prepare=async job=>(await db.query('select public.prepare_item_storage_cleanup($1,$2) ok',[job.id,job.lease_token])).rows[0].ok
const finish=async(job,result)=>(await db.query('select public.finish_item_storage_cleanup($1,$2,$3) ok',[job.id,job.lease_token,result])).rows[0].ok
beforeAll(async()=>{
 db=await database()
 await db.exec(`create role service_role;
 create table public.items(id uuid primary key,company_id uuid);
 create table public.item_media(id uuid primary key,item_id uuid references public.items(id) on delete cascade,url_externa text);
 create table public.blog_posts(id uuid primary key,body text);
 create table public.blog_media(id uuid primary key,post_id uuid references public.blog_posts(id),url_externa text);
 alter table public.items enable row level security;
 create policy items_write on public.items for all to authenticated using(public.has_company_role(company_id,array['admin','editor']));
 grant select,delete on public.items to authenticated;
 create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);`)
 const members=await sqlFile('migrations/COMPANY_MEMBER_ACCESS.sql')
 await db.exec(members.slice(members.indexOf('create or replace function public.has_company_role'),members.indexOf('-- Sensitive changes')))
 const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
 await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
 await db.exec(modules.slice(modules.indexOf('create or replace function public.guard_company_module_write'),modules.indexOf('do $$ declare item record')))
 await db.exec("create trigger guard_company_module_write before delete on public.items for each row execute function public.guard_company_module_write('items')")
 await db.query("insert into public.company_modules values($1,'items',true)",[ids.a])
 await db.exec(await sqlFile('migrations/ITEM_STORAGE_CLEANUP_QUEUE.sql'))
},30000)
afterAll(async()=>db?.close())
beforeEach(async()=>{
 await db.exec('reset role;truncate public.item_storage_deleted_items,public.item_storage_cleanup_queue,public.item_media,public.items,public.blog_media,public.blog_posts cascade;update public.company_modules set is_enabled=true;update public.company_members set is_active=true')
 await db.query('insert into public.items values($1,$2),($3,$4)',[item,ids.a,other,ids.b])
 await db.query('insert into public.item_media values($1,$2,$3)',[media,item,url])
})
it('captures media before parent cascade, with no FK or signed token remaining in the job',async()=>{
 await db.query('update public.item_media set url_externa=$1',[url+'?token=SECRET#fragment'])
 await login(db);await db.query('delete from public.items where id=$1',[item]);await db.exec('reset role')
 expect((await db.query('select * from public.item_media')).rows).toEqual([])
 expect(await rows()).toMatchObject([{company_id:ids.a,item_id:item,path,url,status:'queued'}])
 const job=await claim();expect(await prepare(job)).toBe(true);expect(await finish(job,'done')).toBe(true)
 expect(await rows()).toMatchObject([{status:'done',url:null}])
})
it('captures direct media deletion and rolls the outbox back with failed item deletion',async()=>{
 await db.exec('begin');await db.query('delete from public.items where id=$1',[item]);await db.exec('rollback')
 expect(await rows()).toEqual([])
 expect((await db.query('select * from public.item_storage_deleted_items')).rows).toEqual([])
 await db.query('delete from public.item_media where id=$1',[media])
 expect(await rows()).toMatchObject([{path,status:'queued'}])
})
it('never captures another tenant from a forged URL and stores no malformed URL credentials',async()=>{
 for(const invalid of [url.replace(ids.a,ids.b),url.replace(item,other),url.replace('https://','https://user:secret@'),url.replace('photo.png','bad%25name.png')]){
  await db.exec('truncate public.item_storage_cleanup_queue')
  await db.query('insert into public.item_media values($1,$2,$3) on conflict(id) do update set url_externa=excluded.url_externa',[media,item,invalid])
  await db.query('delete from public.item_media where id=$1',[media])
  expect(await rows()).toMatchObject([{status:'review',path:null,url:null}]);expect(await claim()).toBeUndefined()
 }
})
it.each(['item_media','blog_media'])('preserves shared references independently in %s',async(source)=>{
  await db.query(`insert into public.${source}(id,${source==='item_media'?'item_id,':''}url_externa) values($1,${source==='item_media'?'$2,':''}$${source==='item_media'?3:2})`,source==='item_media'?[ids.outsider,other,url.replace('/public/','/sign/')+'?token=x']:[ids.outsider,url])
 await db.query('delete from public.items where id=$1',[item])
 expect(await prepare(await claim())).toBe(false)
 expect(await rows()).toMatchObject([{status:'review',last_error_code:'shared_reference'}])
})
it('recovers tenant ownership for a child removed after its parent is no longer visible',async()=>{
 await db.query('delete from public.items where id=$1',[item])
 // Model the child-trigger fallback independently from FK timing; concurrency
 // itself must be checked with real PostgreSQL connections before production.
 await db.exec('set session_replication_role=replica')
 try{await db.query('insert into public.item_media values($1,$2,$3)',[ids.outsider,item,url.replace('photo.png','late.png')])}
 finally{await db.exec('set session_replication_role=origin')}
 await db.query('delete from public.item_media where id=$1',[ids.outsider])
 expect((await rows()).find(q=>q.source_media_id===ids.outsider)).toMatchObject({company_id:ids.a,item_id:item,path:path.replace('photo.png','late.png')})
})
it('recognizes encoded/dot-segment URL references and body links conservatively',async()=>{
 const alias=url.replace(`/${item}/`,`/unused/../${item}/`).replace('photo.png','%70hoto.png')
 await db.query('insert into public.blog_posts values($1,$2)',[ids.outsider,`![cover](${alias})`])
 await db.query('delete from public.items where id=$1',[item])
 expect(await prepare(await claim())).toBe(false)
})
it('preserves HTML-encoded body references and blocks their reintroduction after retirement',async()=>{
 const encoded=url.replace('photo.png','&#112;hoto&period;png').replace(item,item.replace('3','&#51;'))
 await db.query('insert into public.blog_posts values($1,$2)',[ids.outsider,`<img src="${encoded}">`])
 await db.query('delete from public.item_media where id=$1',[media])
 const job=await claim();expect(await prepare(job)).toBe(false)
 await db.exec("delete from public.blog_posts;update public.item_storage_cleanup_queue set status='queued',available_at=now()")
 expect(await prepare(await claim())).toBe(true)
 await expect(db.query('insert into public.blog_posts values($1,$2)',[ids.outsider,`<img src="${encoded}">`])).rejects.toThrow('Storage path retired')
})
it('does not let unrelated malformed percent bytes or HTML entities block all cleanup',async()=>{
 await db.query('insert into public.blog_posts values($1,$2)',[ids.outsider,'Unrelated items-media text %ff %00 &#0; &#9999999;'])
 await db.query('delete from public.item_media where id=$1',[media])
 expect(await prepare(await claim())).toBe(true)
})
it('retires paths durably across retries and rejects new references, including aliases',async()=>{
 await db.query('delete from public.item_media where id=$1',[media])
 const job=await claim();expect(await prepare(job)).toBe(true)
 const retired=(await rows())[0].retired_at;expect(retired).not.toBeNull()
 expect(await finish(job,'retry')).toBe(true)
 const alias=url.replace(`/${item}/`,`/unused/../${item}/`)
 await expect(db.query('insert into public.item_media values($1,$2,$3)',[media,item,alias])).rejects.toThrow('Storage path retired')
 await expect(db.query('insert into public.blog_media(id,url_externa) values($1,$2)',[media,url])).rejects.toThrow('Storage path retired')
 await expect(db.query('insert into public.blog_posts values($1,$2)',[media,`<img src="${url}">`])).rejects.toThrow('Storage path retired')
 await db.exec('update public.item_storage_cleanup_queue set available_at=now()');const retry=await claim()
 expect(retry.path).toBe(path);expect(retry.retired_at).toEqual(retired)
 expect(await prepare(retry)).toBe(true);expect(await finish(retry,'done')).toBe(true)
})
it('recovers expired leases but rejects stale tokens, exhausted attempts and invalid limits',async()=>{
 await db.query('delete from public.items where id=$1',[item]);const first=await claim()
 await db.exec("update public.item_storage_cleanup_queue set locked_at=now()-interval '11 minutes'")
 expect(await prepare(first)).toBe(false);const next=await claim()
 expect(next.lease_token).not.toBe(first.lease_token)
 expect(await prepare(first)).toBe(false);expect(await finish(first,'done')).toBe(false)
 await db.exec("update public.item_storage_cleanup_queue set attempts=8,locked_at=now()-interval '11 minutes'")
 expect(await claim()).toBeUndefined();expect((await rows())[0].status).toBe('review')
 for(const limit of [null,0,51])await expect(db.query('select * from public.claim_item_storage_cleanup($1)',[limit])).rejects.toThrow('Invalid batch size')
})
it('denies viewers, strangers, suspended members, disabled modules and browser queue/RPC access',async()=>{
 for(const user of ['viewer','outsider','editorB']){await login(db,user);await db.query('delete from public.items where id=$1',[item]);await db.exec('reset role');expect(await rows()).toEqual([])}
 await db.query('update public.company_members set is_active=false where user_id=$1',[ids.editor]);await login(db);await db.query('delete from public.items where id=$1',[item]);await db.exec('reset role');expect(await rows()).toEqual([])
 await db.exec('update public.company_members set is_active=true;update public.company_modules set is_enabled=false');await login(db)
 await expect(db.query('delete from public.items where id=$1',[item])).rejects.toThrow('Company module is disabled');await db.exec('reset role');expect(await rows()).toEqual([])
 for(const [user,role] of [['editor','authenticated'],[null,'anon']]){
  await login(db,user,role)
  await expect(rows()).rejects.toThrow('permission denied')
  await expect(claim()).rejects.toThrow('permission denied')
  await expect(db.query('select public.prepare_item_storage_cleanup($1,$1)',[item])).rejects.toThrow('permission denied')
  await expect(db.query("select public.finish_item_storage_cleanup($1,$1,'done')",[item])).rejects.toThrow('permission denied')
 }
 await db.exec('reset role;set role service_role');expect(await claim()).toBeUndefined()
})
