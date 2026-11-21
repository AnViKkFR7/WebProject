import {PGlite} from '@electric-sql/pglite'
import {loadBootstrap} from '../../../scripts/build-database-bootstrap.mjs'
import {ids,sqlFile} from './helpers'
export async function fullApplication({watch=false}={}){
 const db=new PGlite()
 // Only the platform contract is modeled here; no application tables/helpers.
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email varchar,email_confirmed_at timestamptz,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid);
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated;`)
 const steps=(await loadBootstrap()).steps
 for(const step of steps){
  if(watch&&step.path==='migrations/WEEKLY_SUMMARY_METRICS.sql'){
   for(const file of ['WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql','WEEKLY_SUMMARY_EMAIL_WATCH_TEST_FIX.sql','WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql','WEEKLY_SUMMARY_EMAIL_WATCH_RESEND.sql'])await db.exec(await sqlFile('migrations/'+file))
  }
  try{await db.exec(step.sql)}catch(error){throw new Error(`Bootstrap failed at ${step.path}: ${error.message}`,{cause:error})}
 }
 for(const key of ['editor','viewer','editorB','admin'])await db.query('insert into auth.users(id,email) values($1,$2)',[ids[key],`${key}@example.test`])
 for(const company of ['a','b'])await db.query("insert into public.companies(id,name,contact_email,contact_phone,created_by) values($1,$2,'company@example.test','600000000',$3)",[ids[company],company,ids.admin])
 for(const [company,user,role] of [['a','editor','editor'],['a','viewer','viewer'],['a','admin','admin'],['b','editorB','editor']])await db.query('insert into public.company_members(company_id,user_id,role) values($1,$2,$3)',[ids[company],ids[user],role])
 await db.query("update auth.users set raw_app_meta_data=' {\"app_role\":\"admin\"}'::jsonb where id=$1",[ids.admin])
 return db
}
