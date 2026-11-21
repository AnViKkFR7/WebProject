import {afterAll,beforeAll,describe,expect,it} from 'vitest'
import {fullApplication} from './fullApplication'
import {ids,login} from './helpers'

// Auditoría de seguridad 21/11/2026 sobre la base completa (bootstrap real):
// ninguna tabla con company_id deja ver filas de otra empresa, y lo público se limita a lo publicado.
let db
const draftA='40000000-0000-4000-8000-000000000001',publishedA='40000000-0000-4000-8000-000000000002'
// Contenido que las webs leen con la clave pública: solo cuenta si está publicado.
const publicContent={items:"status='published'",blog_posts:"status='published'"}
const asRole=async(user,role,sql,params)=>{await login(db,user,role);try{return (await db.query(sql,params)).rows}finally{await db.exec('reset role')}}

beforeAll(async()=>{
  db=await fullApplication()
  await db.exec('reset role')
  await db.query(`insert into public.items(id,company_id,item_type,title,status) values($1,$3,'demo','Borrador A','draft'),($2,$3,'demo','Publicado A','published')`,[draftA,publishedA,ids.a])
  for(const [item,url] of [[draftA,'https://example.test/borrador.jpg'],[publishedA,'https://example.test/publico.jpg']])
    await db.query("insert into public.item_media(item_id,file_type,url_externa,alt_text,sort_order) values($1,'image',$2,'foto',0)",[item,url])
  await db.query("insert into public.client_company(company_id,name,user_id) values($1,'Cliente A',$2)",[ids.a,ids.editor])
},240000)
afterAll(async()=>{await db?.close()})

it('has no permissive policy that opens a whole table (using true)',async()=>{
  // Una política permisiva abierta anula las demás (se suman con OR). item_media tuvo una:
  // solo la tapaba por casualidad el filtro de módulos. Ver ITEM_MEDIA_PUBLIC_READ_FIX.sql.
  const open=(await db.query(`select tablename||'.'||policyname p from pg_policies
    where schemaname='public' and permissive='PERMISSIVE' and cmd in ('SELECT','ALL') and btrim(qual)='true' order by 1`)).rows.map(r=>r.p)
  expect(open).toEqual([])
})

describe('item_media',()=>{
  const media=user=>role=>asRole(user,role,'select i.status from public.item_media m join public.items i on i.id=m.item_id where i.company_id=$1 order by 1',[ids.a])
  it('anonymous visitors only see media of published items',async()=>{
    expect((await media(null)('anon')).map(r=>r.status)).toEqual(['published'])
    // El join ya oculta el borrador por la RLS de items: se comprueba también la tabla sola.
    const rows=await asRole(null,'anon','select url_externa from public.item_media where item_id=any($1) order by 1',[[draftA,publishedA]])
    expect(rows.map(r=>r.url_externa)).toEqual(['https://example.test/publico.jpg'])
  })
  it('members of another company cannot read draft media',async()=>{
    const rows=await asRole('editorB','authenticated','select url_externa from public.item_media where item_id=any($1) order by 1',[[draftA,publishedA]])
    expect(rows.map(r=>r.url_externa)).toEqual(['https://example.test/publico.jpg'])
  })
  it('members of the owner company still see everything',async()=>{
    const rows=await asRole('viewer','authenticated','select url_externa from public.item_media where item_id=any($1) order by 1',[[draftA,publishedA]])
    expect(rows).toHaveLength(2)
  })
})

it('no table with company_id exposes private rows of company A to company B or to anonymous visitors',async()=>{
  const tables=(await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attname='company_id' and not a.attisdropped
    where n.nspname='public' and c.relkind in ('r','v') order by 1`)).rows.map(r=>r.relname)
  expect(tables.length).toBeGreaterThan(30)
  const leaks=[]
  for(const [user,role] of [['editorB','authenticated'],[null,'anon']]){
    for(const table of tables){
      const filter=publicContent[table]?` and not (${publicContent[table]})`:''
      try{
        const [{n}]=await asRole(user,role,`select count(*)::int n from public.${table} where company_id=$1${filter}`,[ids.a])
        if(n>0)leaks.push(`${role}:${table}=${n}`)
      }catch(error){
        if(!/permission denied/.test(error.message))throw error
      }
    }
  }
  expect(leaks).toEqual([])
  // La empresa propietaria sí ve sus filas (la prueba no pasa por estar todo vacío).
  expect((await asRole('viewer','authenticated','select count(*)::int n from public.client_company where company_id=$1',[ids.a]))[0].n).toBe(1)
},120000)
