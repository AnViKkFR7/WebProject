import { afterAll, beforeAll, expect, it } from 'vitest'
import { database, ids, login, sqlFile } from './helpers'

let db

beforeAll(async () => {
  db = await database()
  await db.exec(`
    create table public.items(
      id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
      title text not null, summary text, status text not null default 'draft', item_type text not null
    );
    create table public.blog_posts(
      id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
      title text not null, heading text, intro text, body text not null, status text not null default 'draft',
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  `)
  const migration = await sqlFile('migrations/CONTENT_SEO_FIELDS.sql')
  await db.exec(migration)
  await db.exec(migration)
  await login(db)
}, 30000)

afterAll(async () => db?.close())

it('keeps slugs unique within a company, case-insensitively, but isolates companies and content types', async () => {
  await db.query("insert into public.items(company_id,title,item_type,slug) values($1,'Casa','property','casa')", [ids.a])
  await db.query("insert into public.items(company_id,title,item_type,slug) values($1,'Casa','property','casa')", [ids.b])
  await db.query("insert into public.blog_posts(company_id,title,body,slug) values($1,'Casa','Contenido','casa')", [ids.a])

  await expect(db.query("insert into public.items(company_id,title,item_type,slug) values($1,'Duplicado','property','casa')", [ids.a]))
    .rejects.toThrow('duplicate key')
  await expect(db.query("insert into public.items(company_id,title,item_type,slug) values($1,'Mayúsculas','property','CASA')", [ids.a]))
    .rejects.toThrow('items_seo_fields_check')
})

it('validates URL-safe slugs, SEO lengths and HTTPS social images in the database', async () => {
  await expect(db.query("insert into public.items(company_id,title,item_type,slug) values($1,'Casa','property','Casa con espacios')", [ids.a]))
    .rejects.toThrow('items_seo_fields_check')
  await expect(db.query("insert into public.blog_posts(company_id,title,body,seo_title) values($1,'Post','Contenido',$2)", [ids.a, 'x'.repeat(71)]))
    .rejects.toThrow('blog_posts_seo_fields_check')
  await expect(db.query("insert into public.items(company_id,title,item_type,seo_og_image_url) values($1,'Casa','property','javascript:alert(1)')", [ids.a]))
    .rejects.toThrow('items_seo_fields_check')
})

it('sets the first publication time and preserves it through edits and archiving', async () => {
  const { rows: [post] } = await db.query("insert into public.blog_posts(company_id,title,body) values($1,'Post','Contenido') returning *", [ids.a])
  expect(post.published_at).toBeNull()

  const { rows: [published] } = await db.query("update public.blog_posts set status='published' where id=$1 returning *", [post.id])
  expect(published.published_at).toBeTruthy()
  const { rows: [edited] } = await db.query("update public.blog_posts set title='Editado' where id=$1 returning *", [post.id])
  expect(edited.published_at).toEqual(published.published_at)
  const { rows: [archived] } = await db.query("update public.blog_posts set status='archived' where id=$1 returning *", [post.id])
  expect(archived.published_at).toEqual(published.published_at)
})

it('read-only SEO audit reports published legacy posts without slugs', async () => {
  await db.query("insert into public.blog_posts(company_id,title,body,status) values($1,'Antiguo','Contenido','published'),($1,'Borrador','Contenido','draft')", [ids.a])
  const audit = await sqlFile('maintenance/CONTENT_SEO_FIELDS_AUDIT.sql')
  const { rows } = await db.query(audit)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ issue: 'published_slug_missing', title: 'Antiguo', slug: null, status: 'published' })
})
