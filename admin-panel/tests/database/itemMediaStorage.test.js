import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { fullApplication } from './fullApplication'
import { ids, login } from './helpers'

// Hallazgo G: en producción había políticas de Storage creadas en el Dashboard
// sin filtro de bucket. Las guardas restrictivas de ITEM_MEDIA_STORAGE_POLICY_FIX
// deben cerrar items-media al navegador aunque alguien vuelva a crearlas.
let db
const path = `${ids.a}/item-1/foto.webp`

beforeAll(async () => {
  db = await fullApplication()
  // Réplica de la deriva: abiertas a cualquier sesión y a anónimos, sin bucket.
  await db.exec(`
    create policy drift_select on storage.objects for select to public using (true);
    create policy drift_insert on storage.objects for insert to authenticated with check (true);
    create policy drift_update on storage.objects for update to authenticated using (true) with check (true);
    create policy drift_delete on storage.objects for delete to authenticated using (true);
  `)
}, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec('reset role; delete from storage.objects')
  await db.query("insert into storage.objects(bucket_id,name) values('items-media',$1)", [path])
})

const count = async () => (await db.query("select count(*)::int n from storage.objects where bucket_id='items-media'")).rows[0].n

it('no deja que otra empresa liste, suba, cambie ni borre archivos del catálogo', async () => {
  await login(db, 'editorB')
  expect(await count()).toBe(0)
  await expect(db.query("insert into storage.objects(bucket_id,name) values('items-media',$1)", [`${ids.a}/item-1/x.webp`])).rejects.toThrow(/row-level security/)
  await db.query("update storage.objects set name='robado.webp' where bucket_id='items-media'")
  await db.query("delete from storage.objects where bucket_id='items-media'")
  await db.exec('reset role')
  expect((await db.query("select name from storage.objects where bucket_id='items-media'")).rows).toEqual([{ name: path }])
})

it('tampoco el editor de la propia empresa ni anónimos: solo las Edge Functions (service_role)', async () => {
  for (const [user, role] of [['editor'], [null, 'anon']]) {
    await login(db, user, role)
    expect(await count()).toBe(0)
    await expect(db.query("insert into storage.objects(bucket_id,name) values('items-media',$1)", [`${ids.a}/item-1/y.webp`])).rejects.toThrow(/row-level security/)
  }
  await db.exec('reset role')
  expect(await count()).toBe(1)
})

it('no quedan políticas del Dashboard en el esquema de instalación', async () => {
  const { rows } = await db.query("select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%14vvl3r%'")
  expect(rows).toEqual([])
})
