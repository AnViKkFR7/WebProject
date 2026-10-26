import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {buildQuoteApprovalNoticeEmail,splitQuoteNoticeRecipients,type QuoteApprovalNoticePayload} from '../_shared/quoteApprovalEmail.ts'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info'}})
const hashToken=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(byte=>byte.toString(16).padStart(2,'0')).join('')
const logFailure=(code:string)=>console.error('[QUOTE_APPROVAL_NOTICE]',{event:'send_failed',code,occurredAt:new Date().toISOString()})

serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}})
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_DB_KEY')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),resendKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('REMINDERS_FROM_EMAIL'),adminUrl=Deno.env.get('ADMIN_APP_URL')
  if(!url||!key||!resendKey||!from||!adminUrl)return json({error:'missing_configuration'},500)
  let adminOrigin:string
  try{const parsed=new URL(adminUrl);if(parsed.protocol!=='https:')return json({error:'invalid_configuration'},500);adminOrigin=parsed.origin}catch{return json({error:'invalid_configuration'},500)}
  let body:{token?:unknown}
  try{body=await req.json()}catch{return json({error:'invalid_request'},400)}
  if(typeof body.token!=='string'||! /^[0-9a-f]{64}$/.test(body.token))return json({error:'invalid_request'},400)
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const{data,error}=await admin.rpc('get_quote_approval_notification_payload',{p_token_hash:await hashToken(body.token)})
  if(error||!data)return json({sent:false},404)
  try{
    const payload=(Array.isArray(data)?data[0]:data) as QuoteApprovalNoticePayload
    if((payload as QuoteApprovalNoticePayload&{already_notified?:boolean}).already_notified)return json({sent:true,already_sent:true})
    const recipients=splitQuoteNoticeRecipients(payload.recipient_emails)
    if(!recipients.to){logFailure('recipient_unavailable');return json({error:'recipient_unavailable'},409)}
    const quoteUrl=`${adminOrigin}/quotes/${encodeURIComponent(payload.quote_id)}`
    const message=buildQuoteApprovalNoticeEmail(payload,quoteUrl)
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`quote-approval-response/${payload.link_id}`},body:JSON.stringify({from,to:recipients.to,...(recipients.bcc.length?{bcc:recipients.bcc}:{}),subject:message.subject,html:message.html,text:message.text})})
    if(!response.ok){logFailure(response.status>=500||response.status===429?'provider_unavailable':'provider_rejected');return json({error:'email_rejected'},502)}
    const provider=await response.json().catch(()=>({})) as {id?:string}
    const{data:marked,error:markError}=await admin.rpc('mark_quote_approval_notification_sent',{p_link:payload.link_id,p_provider_id:provider.id??null})
    if(markError||!marked){logFailure('sent_marker_failed');return json({sent:true,warning:'delivery_marker_failed'})}
    return json({sent:true})
  }catch{logFailure('unexpected_failure');return json({error:'email_unavailable'},502)}
})
