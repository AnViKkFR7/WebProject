import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {beforeAll,expect,it,vi} from 'vitest'
import {buildWeeklySummaryEmail,splitWeeklySummaryRecipients} from '../../supabase/functions/_shared/weeklySummary'

let code
beforeAll(async()=>{
  const source=await readFile(new URL('../../supabase/functions/send-weekly-summary/index.ts',import.meta.url),'utf8')
  code=(await transform(source,{loader:'ts',format:'cjs'})).code
})

const payload={
  company_id:'company-a',week_start:'2026-10-19',week_end:'2026-10-25',
  recipient_emails:['admin@example.test','second@example.test'],new_leads:3,new_contacts:2,
  overdue_followups:1,issued_invoices:4,overdue_invoices:1,quotes_waiting:5,upcoming_planning:6,page_views:120,
}

async function deliver({secret='cron-test',recipients=payload.recipient_emails,providerStatus=200,completeError=false,enqueueError=null}={}){
  let handler
  const rpcCalls=[]
  const job={queue_id:'queue-a',company_id:'company-a',week_start:'2026-10-19',delivery_generation:2}
  const client={rpc:async(name,args)=>{
    rpcCalls.push({name,args})
    if(name==='enqueue_company_weekly_summaries')return{data:1,error:enqueueError}
    if(name==='claim_company_weekly_summary_batch')return{data:[job],error:null}
    if(name==='get_company_weekly_summary_payload')return{data:{...payload,recipient_emails:recipients},error:null}
    if(name==='complete_company_weekly_summary')return{data:!completeError,error:completeError?new Error('private completion details'):null}
    if(name==='fail_company_weekly_summary')return{data:true,error:null}
    throw new Error(`Unexpected RPC ${name}`)
  }}
  const env={SUPABASE_URL:'https://example.test',SUPABASE_DB_KEY:'test-only',WEEKLY_SUMMARY_CRON_SECRET:'cron-test',RESEND_API_KEY:'resend-test-only',REMINDERS_FROM_EMAIL:'Admin <reports@example.test>',DEPLOYMENT_ENV:'test',APP_VERSION:'test-build'}
  const fetch=vi.fn(async()=>new Response(providerStatus===200?'{"id":"provider-message"}':'{"error":"private provider response"}',{status:providerStatus}))
  const require=name=>name.includes('server.ts')?{serve:fn=>{handler=fn}}:name.includes('supabase-js')?{createClient:()=>client}:{buildWeeklySummaryEmail,splitWeeklySummaryRecipients}
  new Function('require','Deno','fetch','Response',code)(require,{env:{get:key=>env[key]}},fetch,Response)
  const response=await handler(new Request('https://example.test/weekly',{method:'POST',headers:{'x-weekly-summary-secret':secret}}))
  return{response,body:await response.json(),fetch,rpcCalls}
}

it('sends only aggregate metrics to active-admin addresses with a stable Resend key',async()=>{
  const result=await deliver()
  expect(result.body).toEqual({enqueued:1,sent:1,failed:0})
  const request=result.fetch.mock.calls[0][1]
  const message=JSON.parse(request.body)
  expect(message).toMatchObject({from:'Admin <reports@example.test>',to:'admin@example.test',bcc:['second@example.test'],subject:'Resumen semanal · 19 de octubre de 2026 – 25 de octubre de 2026'})
  expect(message.text).toContain('Solicitudes recibidas: 3')
  expect(message.text).not.toContain('admin@example.test')
  expect(message.text).not.toContain('Cliente')
  expect(message.text).not.toContain('Factura F-')
  expect(request.headers['Idempotency-Key']).toBe('weekly-summary/queue-a/2')
  expect(result.rpcCalls.map(call=>call.name)).toEqual(['enqueue_company_weekly_summaries','claim_company_weekly_summary_batch','get_company_weekly_summary_payload','complete_company_weekly_summary'])
})

it('rejects unauthorized requests before contacting the queue or Resend',async()=>{
  const result=await deliver({secret:'wrong'})
  expect(result.response.status).toBe(403)
  expect(result.fetch).not.toHaveBeenCalled()
  expect(result.rpcCalls).toEqual([])
})

it('does not send without an active-admin address and marks the item non-retryable',async()=>{
  const result=await deliver({recipients:[]})
  expect(result.fetch).not.toHaveBeenCalled()
  expect(result.rpcCalls.at(-1)).toMatchObject({name:'fail_company_weekly_summary',args:{p_queue:'queue-a',p_error_code:'recipient_unavailable',p_retryable:false}})
  expect(result.body).toMatchObject({sent:0,failed:1})
})

it('uses a bounded retry code for provider failures and marks accepted-but-unconfirmed sends uncertain',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{})
  const failed=await deliver({providerStatus:503})
  expect(failed.body).toMatchObject({sent:0,failed:1})
  expect(failed.rpcCalls.at(-1)).toMatchObject({name:'fail_company_weekly_summary',args:{p_queue:'queue-a',p_error_code:'provider_unavailable',p_retryable:true}})
  expect(JSON.stringify(failed.body)).not.toContain('private provider response')
  expect(JSON.stringify(log.mock.calls)).not.toContain('admin@example.test')

  const uncertain=await deliver({completeError:true})
  expect(uncertain.rpcCalls.at(-1)).toMatchObject({name:'fail_company_weekly_summary',args:{p_queue:'queue-a',p_error_code:'sent_marker_failed',p_retryable:false,p_provider_id:'provider-message'}})
  expect(uncertain.body).toMatchObject({sent:0,failed:1})
})
