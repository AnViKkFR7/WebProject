import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {buildWeeklySummaryEmail,splitWeeklySummaryRecipients,type WeeklySummaryPayload} from '../_shared/weeklySummary.ts'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const safeCode=(value:unknown)=>typeof value==='string'&&/^[A-Z0-9_]{3,12}$/.test(value)?value:undefined
const envs=new Set(['development','test','ci','staging','production'])
const envValue=Deno.env.get('DEPLOYMENT_ENV');const versionValue=Deno.env.get('APP_VERSION')
const operationalEnvironment=envs.has(envValue||'')?envValue:'unknown'
const operationalVersion=versionValue&&/^[A-Za-z0-9._+-]{1,40}$/.test(versionValue)?versionValue:'unversioned'
const report=(event:string,code:string,databaseCode?:string,httpStatus?:number)=>console.error('[WEEKLY_SUMMARY]',{event,code,environment:operationalEnvironment,version:operationalVersion,occurredAt:new Date().toISOString(),...(databaseCode?{databaseCode}:{}),...(Number.isInteger(httpStatus)?{httpStatus}:{})})

serve(async req=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const secret=Deno.env.get('WEEKLY_SUMMARY_CRON_SECRET')
  const provided=req.headers.get('x-weekly-summary-secret')
  if(!secret||!provided||provided!==secret)return json({error:'forbidden'},403)
  const url=Deno.env.get('SUPABASE_URL')
  const key=Deno.env.get('SUPABASE_DB_KEY')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey=Deno.env.get('RESEND_API_KEY')
  const from=Deno.env.get('REMINDERS_FROM_EMAIL')
  if(!url||!key||!resendKey||!from)return json({error:'missing_configuration'},500)
  const admin=createClient(url,key)
  const{data:enqueued,error:enqueueError}=await admin.rpc('enqueue_company_weekly_summaries')
  if(enqueueError){report('queue_error','enqueue_failed',safeCode(enqueueError.code),Number.isInteger(enqueueError.status)?enqueueError.status:undefined);return json({error:'queue_unavailable'},500)}
  const{data:batch,error:claimError}=await admin.rpc('claim_company_weekly_summary_batch',{p_limit:20})
  if(claimError){report('queue_error','claim_failed',safeCode(claimError.code),Number.isInteger(claimError.status)?claimError.status:undefined);return json({error:'queue_unavailable'},500)}
  let sent=0;let failed=0
  for(const job of (batch??[]) as Array<{queue_id:string;company_id:string;week_start:string;delivery_generation:number}>){
    const fail=async(code:string,retryable=true,providerId:string|null=null)=>{
      const{error}=await admin.rpc('fail_company_weekly_summary',{p_queue:job.queue_id,p_error_code:code,p_retryable:retryable,p_provider_id:providerId})
      if(error)report('queue_error','failure_update_failed',safeCode(error.code))
      failed++
    }
    let providerAccepted=false;let providerId:string|null=null
    try{
      const{data,error}=await admin.rpc('get_company_weekly_summary_payload',{p_queue:job.queue_id})
      if(error){await fail('unexpected_failure');continue}
      const payload=(Array.isArray(data)?data[0]:data) as WeeklySummaryPayload|undefined
      if(!payload)continue
      const recipients=splitWeeklySummaryRecipients(payload.recipient_emails)
      if(!recipients.to){await fail('recipient_unavailable',false);continue}
      const message=buildWeeklySummaryEmail(payload)
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`weekly-summary/${job.queue_id}/${job.delivery_generation}`},body:JSON.stringify({from,to:recipients.to,...(recipients.bcc.length?{bcc:recipients.bcc}:{}),subject:message.subject,html:message.html,text:message.text})})
      if(!response.ok){const retryable=response.status>=500||response.status===409||response.status===429;await fail(retryable?'provider_unavailable':'provider_rejected',retryable);continue}
      providerAccepted=true
      const body=await response.json().catch(()=>({})) as {id?:string};providerId=body.id??null
      const{data:completed,error:completeError}=await admin.rpc('complete_company_weekly_summary',{p_queue:job.queue_id,p_provider_id:providerId})
      if(completeError||!completed){await fail('sent_marker_failed',false,providerId);continue}
      sent++
    }catch{
      if(providerAccepted)await fail('sent_marker_failed',false,providerId)
      else await fail('unexpected_failure')
    }
  }
  if(failed)report('batch_result','has_failures')
  return json({enqueued:Number(enqueued)||0,sent,failed})
})
