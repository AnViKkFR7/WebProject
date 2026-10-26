import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {afterEach,beforeAll,it,expect,vi} from 'vitest'
import {buildPlanningReminder} from '../../supabase/functions/_shared/planningReminder'
let code
beforeAll(async()=>{
  const source=await readFile(new URL('../../supabase/functions/send-planning-reminders/index.ts',import.meta.url),'utf8')
  code=(await transform(source,{loader:'ts',format:'cjs'})).code
})
const task={id:'task-a',company_id:'company-a',created_by:'user-a',title:'Meeting',description:'Project scope',start_datetime:'2026-10-22T17:00:00Z',end_datetime:'2026-10-22T18:00:00Z',type:'reunion',recurrence_type:'none',client_company_id:'client-a'}
async function deliver({active=true,wrongCompany=false,planningEnabled=true,occurrence,secret='cron-test',providerStatus=200,completeError=false,enqueueError=null}={}) {
  const queries=[];const rpcCalls=[];let handler
  const job={queue_id:'queue-a',task_id:task.id,company_id:task.company_id,recipient_id:task.created_by,minutes_before:0,occurrence_at:occurrence,attempt_count:1,delivery_generation:0}
  const client={rpc:async(name,args)=>{rpcCalls.push({name,args});if(name==='enqueue_due_planning_emails')return {data:enqueueError?null:1,error:enqueueError};if(name==='claim_planning_email_batch')return {data:[job],error:null};if(name==='complete_planning_email')return {data:!completeError,error:completeError?new Error('internal failure'):null};if(name==='fail_planning_email')return {data:'dead',error:null};throw new Error(`Unexpected RPC ${name}`)},auth:{admin:{getUserById:async()=>({data:{user:{email:'test@example.test'}}})}},from:table=>{
    const filters={};queries.push({table,filters})
    const lookup=()=>Promise.resolve({data:table==='company_modules'?{is_enabled:planningEnabled}:table==='company_members' ? active?{user_id:task.created_by}:null : table==='planning_task'?wrongCompany?null:task:{name:table==='companies'?'Company A':'Client A'},error:null})
    const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query},maybeSingle:lookup,single:lookup}
    return query
  }}
  const env={SUPABASE_URL:'https://example.test',SUPABASE_DB_KEY:'test-only',REMINDERS_CRON_SECRET:'cron-test',RESEND_API_KEY:'test-only',REMINDERS_FROM_EMAIL:'Planning <test@example.test>'}
  env.DEPLOYMENT_ENV='test';env.APP_VERSION='test-build'
  const fetch=vi.fn(async()=>new Response(providerStatus===200?'{"id":"test-message"}':'{"error":"hidden provider response"}',{status:providerStatus}))
  const require=name=>name.includes('server.ts')?{serve:fn=>{handler=fn}}:name.includes('supabase-js')?{createClient:()=>client}:{buildPlanningReminder}
  new Function('require','Deno','fetch','Response',code)(require,{env:{get:key=>env[key]}},fetch,Response)
  const response=await handler(new Request('https://example.test/reminders',{method:'POST',headers:{'x-reminders-secret':secret}}))
  return {response,body:await response.json(),fetch,queries,rpcCalls}
}
afterEach(()=>vi.restoreAllMocks())
it('sends a queued email with a stable idempotency key and completes the occurrence',async()=>{
  const result=await deliver()
  expect(result.body.sent).toBe(1)
  const body=JSON.parse(result.fetch.mock.calls[0][1].body)
  expect(body.html).toContain('19:00 – 20:00')
  expect(body.html).toContain('Project scope')
  expect(body.text).not.toContain('Invalid Date')
  expect(result.fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('planning-reminder/queue-a/0')
  expect(result.rpcCalls.map(call=>call.name)).toEqual(['enqueue_due_planning_emails','claim_planning_email_batch','complete_planning_email'])
  expect(result.rpcCalls[2].args).toEqual({p_queue:'queue-a',p_provider_id:'test-message'})
  for(const table of ['planning_task','client_company'])expect(result.queries.find(item=>item.table===table).filters.company_id).toBe('company-a')
  expect(result.queries.find(item=>item.table==='company_members').filters.is_active).toBe(true)
  expect(result.queries.find(item=>item.table==='company_modules').filters).toEqual({company_id:'company-a',module_key:'planning'})
})
it('does not send a reminder if Planning was disabled after the queue claim',async()=>{
  const result=await deliver({planningEnabled:false})
  expect(result.fetch).not.toHaveBeenCalled()
  expect(result.body).toMatchObject({sent:0,failed:0})
  expect(result.rpcCalls.map(call=>call.name)).toEqual(['enqueue_due_planning_emails','claim_planning_email_batch'])
})
it('never sends for inactive members, cross-company task mismatches or unauthorized requests',async()=>{
  for(const options of [{active:false},{wrongCompany:true},{secret:'wrong'}]) {
    const result=await deliver(options)
    expect(result.fetch).not.toHaveBeenCalled()
    expect(result.rpcCalls.some(call=>call.name==='complete_planning_email')).toBe(false)
  }
})
it('records only a stable retry code when Resend fails; it does not return provider payload',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{})
  const result=await deliver({providerStatus:503})
  expect(result.body).toMatchObject({sent:0,failed:1})
  expect(JSON.stringify(result.body)).not.toContain('hidden provider response')
  expect(result.rpcCalls.at(-1)).toMatchObject({name:'fail_planning_email',args:{p_queue:'queue-a',p_error_code:'provider_unavailable',p_retryable:true}})
  expect(log).toHaveBeenCalledWith('[REMINDERS]',expect.objectContaining({event:'operation_failed',code:'batch_has_failures',environment:'test',version:'test-build'}))
  expect(JSON.stringify(log.mock.calls)).not.toContain('test@example.test')
  expect(JSON.stringify(log.mock.calls)).not.toContain('hidden provider response')
})
it('marks accepted messages with missing queue confirmation as uncertain and never auto-requeues them',async()=>{
  const result=await deliver({completeError:true})
  expect(result.body).toMatchObject({sent:0,failed:1})
  expect(result.rpcCalls.at(-1)).toMatchObject({name:'fail_planning_email',args:{p_queue:'queue-a',p_error_code:'sent_marker_failed',p_retryable:false,p_provider_id:'test-message'}})
})
it('logs only a sanitized PostgREST error code when enqueueing fails',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{})
  const result=await deliver({enqueueError:{code:'PGRST202',message:'contains private database details',status:404}})
  expect(result.response.status).toBe(500)
  expect(result.body).toEqual({error:'queue_unavailable',code:'PGRST202'})
  expect(result.fetch).not.toHaveBeenCalled()
  expect(log).toHaveBeenCalledWith('[REMINDERS]',expect.objectContaining({event:'operation_failed',code:'enqueue_failed',databaseCode:'PGRST202',httpStatus:404}))
  expect(JSON.stringify(log.mock.calls)).not.toContain('private database details')
})
