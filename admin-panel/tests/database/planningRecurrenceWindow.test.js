import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'
import {recurrenceOccurrence} from '../../src/lib/planningRecurrenceTime'
let db
beforeAll(async()=>{
  db=await database()
  await db.exec(`create role service_role;
    alter table public.planning_task add title text,add created_by uuid,add reminders integer[] default '{}',add recurrence_type text default 'none',add recurrence_value int;
    create table public.planning_reminder_sent(task_id uuid,minutes_before int,occurrence_at timestamptz,primary key(task_id,minutes_before,occurrence_at));
    create table public.company_modules(company_id uuid,module_key text,is_enabled boolean);`)
  const modules=await sqlFile('migrations/COMPANY_MODULES.sql')
  await db.exec(modules.slice(modules.indexOf('create or replace function public.is_company_module_enabled'),modules.indexOf('insert into public.company_modules')))
  await db.query("insert into public.company_modules values($1,'planning',true),($2,'planning',true)",[ids.a,ids.b])
  await db.exec(await sqlFile('migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_RECURRENCE_WINDOW.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_EMAIL_QUEUE.sql'))
},30000)
afterAll(async()=>{await db?.close()})
it('finds reminders for series older than 200 daily/hourly iterations',async()=>{
  for(const type of ['daily','hourly']){
    const anchor=type==='daily'?"(((now()-interval '2 minutes') at time zone 'Europe/Madrid')-interval '400 days') at time zone 'Europe/Madrid'":"now()-interval '10000 hours'-interval '2 minutes'"
    const row=(await db.query(`insert into public.planning_task(company_id,title,created_by,start_datetime,recurrence_type,recurrence_value,reminders) values($1,'Old',$2,${anchor},$3,1,array[0,0]) returning id`,[ids.a,ids.editor,type])).rows[0]
    const due=(await db.query('select * from public.due_planning_reminders(10) where task_id=$1',[row.id])).rows
    expect(due).toHaveLength(1)
    await db.query('insert into public.planning_reminder_sent values($1,0,$2)',[row.id,due[0].occurrence_at])
    expect((await db.query('select * from public.due_planning_reminders(10) where task_id=$1',[row.id])).rows).toEqual([])
  }
})
it('has identical SQL and browser occurrence instants across DST, leap days and long histories',async()=>{
  const cases=[['2026-03-28T01:30:00Z','daily',1,1],['2026-10-24T00:30:00Z','daily',1,1],['2026-03-28T09:00:00Z','daily',1,1],['2020-02-29T09:00:00Z','yearly',1,5],['2020-01-01T09:00:00Z','hourly',1,100000],['2020-01-01T09:00:00Z','weekly',2,500]]
  for(const [start,type,every,index] of cases){
    const result=(await db.query('select public.planning_occurrence_at($1,public.planning_recurrence_step($2,$3),$4,$2) instant',[start,type,every,index])).rows[0].instant
    expect(new Date(result).toISOString()).toBe(recurrenceOccurrence(new Date(start),type,every,index).toISOString())
  }
})
it('feeds the existing email queue without duplicating ancient recurring occurrences',async()=>{
  const row=(await db.query("insert into public.planning_task(company_id,title,created_by,start_datetime,recurrence_type,recurrence_value,reminders) values($1,'Queue',$2,now()-interval '2000 hours'-interval '3 minutes','hourly',1,array[0]) returning id",[ids.a,ids.editor])).rows[0]
  expect((await db.query('select public.enqueue_due_planning_emails(10) n')).rows[0].n).toBe(1)
  expect((await db.query('select public.enqueue_due_planning_emails(10) n')).rows[0].n).toBe(0)
  expect((await db.query('select company_id,task_id from public.planning_email_queue')).rows).toEqual([{company_id:ids.a,task_id:row.id}])
})
it('validates window sizes and protects reminder access and disabled modules',async()=>{
  for(const minutes of [null,0,61])await expect(db.query('select * from public.due_planning_reminders($1)',[minutes])).rejects.toThrow('Invalid reminder window')
  await db.query('update public.company_modules set is_enabled=false where company_id=$1',[ids.a])
  expect((await db.query('select * from public.due_planning_reminders(10)')).rows).toEqual([])
  for(const [user,role] of [[null,'anon'],['editor','authenticated']]){await login(db,user,role);await expect(db.query('select * from public.due_planning_reminders(10)')).rejects.toThrow('permission denied')}
  await db.exec('reset role;set role service_role');expect((await db.query('select * from public.due_planning_reminders(10)')).rows).toEqual([])
})
