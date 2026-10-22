import {beforeAll,afterAll,it,expect} from 'vitest'
import {database,sqlFile,ids} from './helpers'
let db
beforeAll(async()=>{
  db=await database()
  await db.exec(`create role service_role;
    alter table public.planning_task add column title text default 'Meeting',add column created_by uuid,add column reminders integer[] default '{}',add column recurrence_type text default 'none',add column recurrence_value integer;
    create table public.planning_reminder_sent(task_id uuid,minutes_before integer,occurrence_at timestamptz,primary key(task_id,minutes_before,occurrence_at));`)
  await db.exec(await sqlFile('migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql'))
},30000)
afterAll(async()=>{await db?.close()})
it('returns occurrence_at as a real timestamptz and does not return already sent occurrences',async()=>{
  await db.query("insert into public.planning_task(company_id,created_by,start_datetime,reminders) values($1,$2,now()-interval '1 minute',array[0])",[ids.a,ids.editor])
  const rows=(await db.query('select * from public.due_planning_reminders(10)')).rows
  expect(rows).toHaveLength(1)
  expect(Number.isFinite(new Date(rows[0].occurrence_at).getTime())).toBe(true)
  expect(rows[0].company_id).toBe(ids.a)
  await db.query('insert into public.planning_reminder_sent values($1,$2,$3)',[rows[0].task_id,rows[0].minutes_before,rows[0].occurrence_at])
  expect((await db.query('select * from public.due_planning_reminders(10)')).rows).toHaveLength(0)
})
it('keeps daily and weekly local clock times across DST, while hourly events use elapsed hours',async()=>{
  const rows=(await db.query(`select
    public.planning_occurrence_at('2026-10-22T17:00:00Z','7 days',1,'weekly')::text weekly,
    public.planning_occurrence_at('2026-03-28T18:00:00Z','1 day',1,'daily')::text daily,
    public.planning_occurrence_at('2026-10-25T00:30:00Z','1 hour',1,'hourly')::text hourly`)).rows[0]
  expect(new Date(rows.weekly).toISOString()).toBe('2026-10-29T18:00:00.000Z')
  expect(new Date(rows.daily).toISOString()).toBe('2026-03-29T17:00:00.000Z')
  expect(new Date(rows.hourly).toISOString()).toBe('2026-10-25T01:30:00.000Z')
})
it('does not expose pending private events to application users',async()=>{
  await db.exec('set role authenticated')
  await expect(db.query('select * from public.due_planning_reminders(10)')).rejects.toThrow('permission denied')
})
