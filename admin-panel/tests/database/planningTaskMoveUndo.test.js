import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  await db.exec(await sqlFile('migrations/PLANNING_TENANT_HARDENING.sql'))
  await db.exec(await sqlFile('migrations/PLANNING_TASK_MOVE_UNDO.sql'))
  await login(db)
},30000)
afterAll(async()=>db?.close())

async function task(company=ids.a){
  return (await db.query("insert into public.planning_task(company_id,start_datetime,end_datetime) values($1,'2026-10-24T09:00:00Z','2026-10-24T10:00:00Z') returning *",[company])).rows[0]
}

it('moves with an expected version and can undo only the exact latest move',async()=>{
  const original=await task()
  const moved=(await db.query("select public.move_planning_task($1,$2,$3,'2026-10-25T09:00:00Z','2026-10-25T10:30:00Z') result",[ids.a,original.id,original.version])).rows[0].result
  expect(moved.task.version).toBe(2)
  const restored=(await db.query('select public.undo_planning_task_move($1,$2,$3,$4) result',[ids.a,original.id,moved.move_id,moved.version])).rows[0].result
  expect(restored.task.start_datetime).toContain('2026-10-24T10:00:00')
  expect(restored.version).toBe(3)
  await expect(db.query('select public.undo_planning_task_move($1,$2,$3,$4)',[ids.a,original.id,moved.move_id,restored.version])).rejects.toThrow('no longer be undone')
})

it('rejects stale, cross-company and unauthorized moves',async()=>{
  const original=await task()
  await expect(db.query("select public.move_planning_task($1,$2,99,'2026-10-25T09:00:00Z','2026-10-25T10:00:00Z')",[ids.a,original.id])).rejects.toThrow('Task changed')
  await login(db,'dual')
  await expect(db.query("select public.move_planning_task($1,$2,1,'2026-10-25T09:00:00Z','2026-10-25T10:00:00Z')",[ids.b,original.id])).rejects.toThrow('Task changed')
  await login(db,'viewer')
  await expect(db.query("select public.move_planning_task($1,$2,1,'2026-10-25T09:00:00Z','2026-10-25T10:00:00Z')",[ids.a,original.id])).rejects.toThrow('Forbidden')
})
