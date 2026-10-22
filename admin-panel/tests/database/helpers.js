import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

export const ids = {
  a:'10000000-0000-4000-8000-000000000001', b:'10000000-0000-4000-8000-000000000002',
  editor:'20000000-0000-4000-8000-000000000001', viewer:'20000000-0000-4000-8000-000000000002',
  outsider:'20000000-0000-4000-8000-000000000003', admin:'20000000-0000-4000-8000-000000000004',
  editorB:'20000000-0000-4000-8000-000000000005', dual:'20000000-0000-4000-8000-000000000006',
}
export const profile = { name:'Issuer A',taxId:'A123',address:'Madrid',email:'',phone:'',color:'#635bff',logo:'',prefix:'F',quotePrefix:'P',payment:'',iban:'',notes:'' }
export const document = () => ({ issuer:{ ...profile },customer:{ name:'Client',taxId:'B456',address:'Barcelona',email:'' },date:'2026-10-22',dueDate:'',withholding:0,lines:[{ description:'Service',quantity:1,price:100,discount:0,tax:21 }],payment:'',iban:'',notes:'' })
const root = new URL('../../../database/', import.meta.url)
export const sqlFile = path => readFile(new URL(path,root),'utf8')
export async function database() {
  const db = new PGlite()
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create table public.companies(id uuid primary key);
    create table public.company_members(company_id uuid references public.companies(id),user_id uuid references auth.users(id),role text,is_active boolean not null default true);
    create table public.client_company(id uuid primary key default gen_random_uuid(),company_id uuid references public.companies(id),name text);
    create table public.planning_task(id uuid primary key default gen_random_uuid(),company_id uuid references public.companies(id),client_company_id uuid references public.client_company(id),start_datetime timestamptz,attachments jsonb default '[]');
    create table public.billing(id uuid primary key default gen_random_uuid(),company_id uuid references public.companies(id),client_company_id uuid references public.client_company(id),billing_date date,attachments jsonb default '[]');
    grant usage on schema public,auth to authenticated,anon;
    grant execute on all functions in schema auth to authenticated,anon;
    alter default privileges in schema public grant all on tables to authenticated,anon;
  `)
  const base = await sqlFile('schema/DB_SCHEMA.sql')
  await db.exec(base.slice(base.indexOf('create or replace function public.is_platform_admin()'),base.indexOf('-- 2) Campos audit')))
  await db.query('insert into public.companies(id) values ($1),($2)',[ids.a,ids.b])
  for (const key of ['editor','viewer','outsider','admin','editorB','dual']) await db.query('insert into auth.users values ($1)',[ids[key]])
  for (const [company,user,role] of [['a','editor','editor'],['a','viewer','viewer'],['b','editorB','editor'],['a','dual','editor'],['b','dual','editor']]) {
    await db.query('insert into public.company_members values ($1,$2,$3)',[ids[company],ids[user],role])
  }
  await db.exec(await sqlFile('migrations/INVOICING.sql'))
  await db.exec(await sqlFile('migrations/QUOTES.sql'))
  await db.exec(await sqlFile('schema/PLANNING_SCHEMA.sql'))
  await db.exec('grant select,insert,update,delete on public.client_company, public.planning_task,public.billing to authenticated')
  return db
}
export async function login(db,user='editor', role='authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user ? ids[user] : '',JSON.stringify(user === 'admin' ? { app_metadata:{ app_role:'admin' } } : {})])
  await db.exec(`set role ${role === 'anon' ? 'anon' : 'authenticated'}`)
}
export async function save(db,company=ids.a,doc=document(),status='draft',kind='invoice',record=null) {
  return (await db.query(`select * from public.${kind === 'quote' ? 'save_quote' : 'save_invoice'}($1,$2::jsonb,$3,$4,$5)`,[company,JSON.stringify(doc),status,record?.id || null,record?.version || null])).rows[0]
}
