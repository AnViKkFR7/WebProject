import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { fullApplication } from './fullApplication'
import { ids, login } from './helpers'

// Imágenes del blog: Storage y blog_media se autorizan en el servidor,
// por empresa, rol y módulo. Incluye las denegaciones entre empresas.
let db
let postA
const url = (company, post, file = 'foto.webp') => `https://demo.supabase.co/storage/v1/object/public/blog-media/${company}/${post}/${file}`

const upload = (name) => db.query("insert into storage.objects(bucket_id,name) values('blog-media',$1)", [name])
const addMedia = (fields) => db.query(
  'insert into public.blog_media(post_id,file_type,url_externa,alt_text,is_cover_image,sort_order) values($1,$2,$3,$4,$5,$6) returning id',
  [fields.post ?? postA, fields.type ?? 'image', fields.url ?? url(ids.a, postA), fields.alt ?? 'Alt', fields.cover ?? false, fields.order ?? 0],
)

beforeAll(async () => { db = await fullApplication() }, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec("reset role; update public.company_modules set is_enabled=true where module_key='blog'; delete from public.blog_media; delete from public.blog_posts; delete from storage.objects")
  postA = (await db.query("insert into public.blog_posts(company_id,title,body) values($1,'Post A','Cuerpo') returning id", [ids.a])).rows[0].id
})

it('configura el bucket público con límite de tamaño y solo imágenes', async () => {
  const bucket = (await db.query("select public,file_size_limit::int as file_size_limit,allowed_mime_types from storage.buckets where id='blog-media'")).rows[0]
  expect(bucket).toEqual({ public: true, file_size_limit: 5242880, allowed_mime_types: ['image/webp', 'image/jpeg', 'image/png'] })
})

it('un editor sube en la carpeta de su artículo', async () => {
  await login(db, 'editor')
  await expect(upload(`${ids.a}/${postA}/abc_1.webp`)).resolves.toBeDefined()
})

it('deniega subir a otra empresa, a un artículo ajeno, a lectores, anónimos y nombres raros', async () => {
  await login(db, 'editorB')
  await expect(upload(`${ids.a}/${postA}/x.webp`)).rejects.toThrow(/row-level security/)
  await expect(upload(`${ids.b}/${postA}/x.webp`)).rejects.toThrow(/row-level security/)
  await login(db, 'viewer')
  await expect(upload(`${ids.a}/${postA}/x.webp`)).rejects.toThrow(/row-level security/)
  await login(db, null, 'anon')
  await expect(upload(`${ids.a}/${postA}/x.webp`)).rejects.toThrow(/row-level security/)
  await login(db, 'editor')
  await expect(upload(`${ids.a}/${postA}/../x.webp`)).rejects.toThrow(/row-level security/)
  await expect(upload(`${ids.a}/${postA}/x.svg`)).rejects.toThrow(/row-level security/)
  await expect(upload(`${ids.a}/${postA}/sub/x.webp`)).rejects.toThrow(/row-level security/)
})

it('deniega subir si el módulo Blog está desactivado', async () => {
  await db.query("update public.company_modules set is_enabled=false where company_id=$1 and module_key='blog'", [ids.a])
  await login(db, 'editor')
  await expect(upload(`${ids.a}/${postA}/x.webp`)).rejects.toThrow()
})

it('admite hasta 3 imágenes y una sola portada', async () => {
  await login(db, 'editor')
  await addMedia({ cover: true, url: url(ids.a, postA, 'a.webp') })
  await addMedia({ url: url(ids.a, postA, 'b.webp'), order: 1 })
  await expect(addMedia({ cover: true, url: url(ids.a, postA, 'c.webp') })).rejects.toThrow(/una portada/)
  await addMedia({ url: url(ids.a, postA, 'c.webp'), order: 2 })
  await expect(addMedia({ url: url(ids.a, postA, 'd.webp'), order: 3 })).rejects.toThrow(/Máximo 3/)
})

it('rechaza URLs fuera de la carpeta del artículo y archivos que no son imagen', async () => {
  await login(db, 'editor')
  await expect(addMedia({ url: url(ids.b, postA) })).rejects.toThrow(/carpeta de este artículo/)
  await expect(addMedia({ url: 'https://otra-web.es/foto.webp' })).rejects.toThrow(/carpeta de este artículo/)
  await expect(addMedia({ type: 'pdf' })).rejects.toThrow(/solo admite imágenes/)
})

it('otra empresa no puede añadir imágenes al artículo', async () => {
  await login(db, 'editorB')
  await expect(addMedia({})).rejects.toThrow()
  await db.exec('reset role')
  expect((await db.query('select count(*)::int n from public.blog_media')).rows[0].n).toBe(0)
})

it('cambiar la portada funciona quitando primero la anterior', async () => {
  await login(db, 'editor')
  const first = (await addMedia({ cover: true, url: url(ids.a, postA, 'a.webp') })).rows[0].id
  const second = (await addMedia({ url: url(ids.a, postA, 'b.webp'), order: 1 })).rows[0].id
  await db.query('update public.blog_media set is_cover_image=false where id=$1', [first])
  await db.query('update public.blog_media set is_cover_image=true where id=$1', [second])
  await db.exec('reset role')
  expect((await db.query('select id from public.blog_media where is_cover_image')).rows.map(row => row.id)).toEqual([second])
})
