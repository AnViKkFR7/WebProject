import {it,expect} from 'vitest'
import {buildPlanningReminder} from '../../supabase/functions/_shared/planningReminder'
const task={id:'task-a',company_id:'company-a',created_by:'user-a',title:'Reunión de seguimiento',description:'Revisar el presupuesto.\nConfirmar siguientes pasos.',start_datetime:'2026-10-22T17:00:00Z',end_datetime:'2026-10-22T18:00:00Z',type:'reunion',recurrence_type:'none'}
const reminder={task_id:task.id,company_id:task.company_id,created_by:task.created_by,minutes_before:60,occurrence_at:task.start_datetime}
it('includes a correctly localized date, full time range, company, client, type and description in HTML and plain text',()=>{
  const message=buildPlanningReminder(reminder,task,'Compañía A','Cliente Uno')
  expect(message.html).toContain('jueves, 22 de octubre de 2026')
  expect(message.html).toContain('19:00 – 20:00')
  for(const detail of ['Compañía A','Cliente Uno','Reunión','Europe/Madrid','Revisar el presupuesto.']) expect(message.html).toContain(detail)
  expect(message.text).toContain('19:00 – 20:00')
  expect(message.subject).toContain('22/10/2026 19:00')
  expect(message.html).not.toContain('Invalid Date')
  expect(message.occurrenceAt).toBe('2026-10-22T17:00:00.000Z')
})
it('repairs a missing/invalid legacy occurrence from the persisted non-recurring task',()=>{
  for(const value of [undefined,null,'not-a-date','2026-10-22T19:00']) {
    const message=buildPlanningReminder({...reminder,occurrence_at:value},task,'Company')
    expect(message.occurrenceAt).toBe('2026-10-22T17:00:00.000Z')
    expect(message.text).not.toContain('Invalid Date')
  }
})
it('uses the actual recurrence with the correct winter timezone and refuses to guess missing recurring dates',()=>{
  const recurring={...task,recurrence_type:'weekly'}
  const message=buildPlanningReminder({...reminder,occurrence_at:'2026-10-29T17:00:00Z'},recurring,'Company')
  expect(message.html).toContain('jueves, 29 de octubre de 2026')
  expect(message.html).toContain('18:00 – 19:00')
  expect(()=>buildPlanningReminder({...reminder,occurrence_at:undefined},recurring,'Company')).toThrow('occurrence_at')
})
it('prevents company/creator mismatches and HTML/header injection',()=>{
  expect(()=>buildPlanningReminder({...reminder,company_id:'other'},task,'Company')).toThrow('mismatch')
  expect(()=>buildPlanningReminder({...reminder,created_by:'other'},task,'Company')).toThrow('mismatch')
  const message=buildPlanningReminder(reminder,{...task,title:'<img src=x onerror=alert(1)>\nBcc: example',description:'<script>run()</script>'},'<Company>')
  expect(message.html).toContain('&lt;img')
  expect(message.html).not.toContain('<script>')
  expect(message.html).toContain('&lt;Company&gt;')
  expect(message.subject).not.toContain('\n')
})
it('labels all-day events clearly and rejects an invalid persisted start instead of sending a broken date',()=>{
  expect(buildPlanningReminder(reminder,{...task,is_all_day:true},'Company').html).toContain('Todo el día')
  expect(()=>buildPlanningReminder({...reminder,occurrence_at:null},{...task,start_datetime:'broken'},'Company')).toThrow('occurrence_at')
})
