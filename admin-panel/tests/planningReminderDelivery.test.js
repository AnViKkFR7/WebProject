import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {beforeAll,it,expect,vi} from 'vitest'
import {buildPlanningReminder} from '../../supabase/functions/_shared/planningReminder'
let code
beforeAll(async()=>{
  const source=await readFile(new URL('../../supabase/functions/send-planning-reminders/index.ts',import.meta.url),'utf8')
  code=(await transform(source,{loader:'ts',format:'cjs'})).code
})
const task={id:'task-a',company_id:'company-a',created_by:'user-a',title:'Meeting',description:'Project scope',start_datetime:'2026-10-22T17:00:00Z',end_datetime:'2026-10-22T18:00:00Z',type:'reunion',recurrence_type:'none',client_company_id:'client-a'}
async function deliver({active=true,wrongCompany=false,occurrence,secret='cron-test'}={}) {
  const queries=[];const sent=[];let handler
  const reminder={task_id:task.id,company_id:task.company_id,created_by:task.created_by,minutes_before:0,occurrence_at:occurrence}
  const client={rpc:async()=>({data:[reminder]}),auth:{admin:{getUserById:async()=>({data:{user:{email:'test@example.test'}}})}},from:table=>{
    const filters={};queries.push({table,filters})
    const lookup=()=>Promise.resolve({data:table==='company_members' ? active?{user_id:task.created_by}:null : table==='planning_task'?wrongCompany?null:task:{name:table==='companies'?'Company A':'Client A'},error:null})
    const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query},maybeSingle:lookup,single:lookup,insert:async row=>{sent.push(row);return {error:null}}}
    return query
  }}
  const env={SUPABASE_URL:'https://example.test',SUPABASE_DB_KEY:'test-only',REMINDERS_CRON_SECRET:'cron-test',RESEND_API_KEY:'test-only',REMINDERS_FROM_EMAIL:'Planning <test@example.test>'}
  const fetch=vi.fn(async()=>new Response('{"id":"test-message"}',{status:200}))
  const require=name=>name.includes('server.ts')?{serve:fn=>{handler=fn}}:name.includes('supabase-js')?{createClient:()=>client}:{buildPlanningReminder}
  new Function('require','Deno','fetch','Response',code)(require,{env:{get:key=>env[key]}},fetch,Response)
  const response=await handler(new Request('https://example.test/reminders',{method:'POST',headers:{'x-reminders-secret':secret}}))
  return {response,body:await response.json(),fetch,queries,sent}
}
it('sends the rich email and records the resolved occurrence instead of an undefined date',async()=>{
  const result=await deliver()
  expect(result.body.sent).toBe(1)
  const body=JSON.parse(result.fetch.mock.calls[0][1].body)
  expect(body.html).toContain('19:00 – 20:00')
  expect(body.html).toContain('Project scope')
  expect(body.text).not.toContain('Invalid Date')
  expect(result.sent[0].occurrence_at).toBe('2026-10-22T17:00:00.000Z')
  for(const table of ['planning_task','client_company'])expect(result.queries.find(item=>item.table===table).filters.company_id).toBe('company-a')
  expect(result.queries.find(item=>item.table==='company_members').filters.is_active).toBe(true)
})
it('never sends for inactive members, cross-company task mismatches or unauthorized requests',async()=>{
  for(const options of [{active:false},{wrongCompany:true},{secret:'wrong'}]) {
    const result=await deliver(options)
    expect(result.fetch).not.toHaveBeenCalled()
    expect(result.sent).toHaveLength(0)
  }
})
