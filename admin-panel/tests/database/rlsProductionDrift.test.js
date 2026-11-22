import { afterAll, beforeAll, expect, it } from 'vitest'
import { fullApplication } from './fullApplication'
import { ids, login, sqlFile } from './helpers'

// Hallazgo H: producción tenía RLS desactivada en cinco tablas y anon con permisos de
// escritura. Se reproduce esa deriva, se comprueba la fuga y se aplica la corrección.
let db
const drifted = ['client_company', 'planning_task', 'billing', 'attached_file', 'client_company_members']
const anonCanRead = ['attribute_definitions', 'attribute_values', 'blog_media', 'blog_posts', 'companies', 'item_media', 'item_media_summary', 'items']

const clientsOfA = async (user, role) => {
  await login(db, user, role)
  try { return (await db.query('select count(*)::int n from public.client_company where company_id=$1', [ids.a])).rows[0].n }
  finally { await db.exec('reset role') }
}

beforeAll(async () => {
  db = await fullApplication()
  await db.query("insert into public.client_company(company_id,name,user_id) values($1,'Cliente A',$2)", [ids.a, ids.editor])
  await db.query("insert into public.items(company_id,item_type,title,status) values($1,'demo','Publicado','published')", [ids.a])
  // Estado de producción antes de la corrección.
  for (const table of drifted) await db.exec(`alter table public.${table} disable row level security`)
  await db.exec('grant all on all tables in schema public to anon')
}, 60000)
afterAll(async () => db?.close())

it('reproduce la fuga y la cierra con RLS_PRODUCTION_DRIFT_FIX', async () => {
  expect(await clientsOfA(null, 'anon')).toBe(1)
  expect(await clientsOfA('editorB')).toBe(1)

  await db.exec(await sqlFile('migrations/RLS_PRODUCTION_DRIFT_FIX.sql'))

  const noRls = await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity")
  expect(noRls.rows).toEqual([])
  await expect(clientsOfA(null, 'anon')).rejects.toThrow(/permission denied/)
  expect(await clientsOfA('editorB')).toBe(0)
  // El panel de la empresa propietaria sigue viendo sus clientes y editándolos por la RPC.
  expect(await clientsOfA('viewer')).toBe(1)
  await login(db, 'editor')
  try {
    const party = (await db.query('select id from public.client_company where company_id=$1', [ids.a])).rows[0].id
    await db.query("select public.save_directory_party($1,$2,'{\"name\":\"Cliente A\",\"is_client\":true,\"notes\":\"ok\"}'::jsonb)", [ids.a, party])
  } finally { await db.exec('reset role') }
  expect((await db.query('select notes from public.client_company where company_id=$1', [ids.a])).rows[0].notes).toBe('ok')
})

it('anon solo conserva lectura del contenido publicado y las webs siguen leyéndolo', async () => {
  const grants = await db.query("select table_name, privilege_type from information_schema.role_table_grants where grantee='anon' and table_schema='public' order by 1,2")
  expect(grants.rows.filter(r => r.privilege_type !== 'SELECT')).toEqual([])
  expect(grants.rows.map(r => r.table_name)).toEqual(anonCanRead)
  await login(db, null, 'anon')
  const { rows } = await db.query("select title from public.items where status='published'")
  await db.exec('reset role')
  expect(rows.map(r => r.title)).toEqual(['Publicado'])
})

it('es idempotente', async () => {
  await expect(db.exec(await sqlFile('migrations/RLS_PRODUCTION_DRIFT_FIX.sql'))).resolves.toBeDefined()
})
