import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {renderCustomerBillingEmail,resolveCustomerEmailLanguage} from '../../../admin-panel/src/lib/customerEmailTemplate.js'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info'}})
const hashToken=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(byte=>byte.toString(16).padStart(2,'0')).join('')
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validToken=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)
const logFailure=(code:string)=>console.error('[QUOTE_APPROVAL_EMAIL]',{event:'send_failed',code,occurredAt:new Date().toISOString()})

serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}})
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const auth=req.headers.get('authorization')||''
  const accessToken=auth.match(/^Bearer\s+(.+)$/i)?.[1]
  const url=Deno.env.get('SUPABASE_URL'),anonKey=Deno.env.get('SUPABASE_ANON_KEY'),resendKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('REMINDERS_FROM_EMAIL'),adminUrl=Deno.env.get('ADMIN_APP_URL')
  if(!accessToken)return json({error:'unauthorized'},401)
  if(!url||!anonKey||!resendKey||!from||!adminUrl)return json({error:'missing_configuration'},500)
  let adminOrigin:string
  try{const parsed=new URL(adminUrl);if(parsed.protocol!=='https:')return json({error:'invalid_configuration'},500);adminOrigin=parsed.origin}catch{return json({error:'invalid_configuration'},500)}
  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:`Bearer ${accessToken}`}},auth:{persistSession:false,autoRefreshToken:false}})
  const{data:userData,error:userError}=await userClient.auth.getUser(accessToken)
  if(userError||!userData.user)return json({error:'unauthorized'},401)
  let body:{company_id?:unknown;quote_id?:unknown;token?:unknown}
  try{body=await req.json()}catch{return json({error:'invalid_request'},400)}
  if(typeof body.company_id!=='string'||!uuid.test(body.company_id)||typeof body.quote_id!=='string'||!uuid.test(body.quote_id)||!validToken(body.token))return json({error:'invalid_request'},400)
  const tokenHash=await hashToken(body.token)
  const{data,error}=await userClient.rpc('get_quote_approval_email_payload',{p_user:userData.user.id,p_company:body.company_id,p_quote:body.quote_id,p_token_hash:tokenHash})
  if(error||!data){logFailure('payload_unavailable');return json({error:'quote_unavailable'},409)}
  try{
    const payload=(Array.isArray(data)?data[0]:data) as QuoteApprovalLinkPayload & {link_id:string}
    const approvalUrl=`${adminOrigin}/quotes/respond#${body.token}`
    const{data:settingsData,error:settingsError}=await userClient.rpc('get_company_customer_email_template',{p_company:body.company_id,p_template:'quote_approval',p_language:'es',p_user:userData.user.id})
    if(settingsError)logFailure('template_settings_unavailable')
    let settings=(Array.isArray(settingsData)?settingsData[0]:settingsData) as {company_name?:string;brand?:Record<string,unknown>;template?:Record<string,string>}|null
    const emailLanguage=resolveCustomerEmailLanguage(settings?.brand)
    if(emailLanguage==='en'){
      const{data:englishData,error:englishError}=await userClient.rpc('get_company_customer_email_template',{p_company:body.company_id,p_template:'quote_approval',p_language:'en',p_user:userData.user.id})
      if(englishError){logFailure('template_settings_unavailable');settings={...settings,template:undefined}}
      else settings=(Array.isArray(englishData)?englishData[0]:englishData) as typeof settings
    }
    const messageData={kind:'quote_approval',language:emailLanguage,companyName:settings?.company_name||payload.company_name,data:{customer_name:payload.recipient_name,quote_number:payload.quote_number,approval_url:approvalUrl,expires_at:new Date(payload.expires_at).toLocaleDateString(emailLanguage==='en'?'en-GB':'es-ES',{timeZone:'Europe/Madrid'})},brand:settings?.brand||{}}
    let message
    try{message=renderCustomerBillingEmail({...messageData,template:settings?.template})}
    catch{logFailure('template_invalid');message=renderCustomerBillingEmail(messageData)}
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`quote-approval-link/${payload.link_id}`},body:JSON.stringify({from,to:payload.recipient_email,subject:message.subject,html:message.html,text:message.text,...(message.attachments.length?{attachments:message.attachments}:{})})})
    if(!response.ok){logFailure(response.status>=500||response.status===429?'provider_unavailable':'provider_rejected');return json({error:'email_rejected'},502)}
    const provider=await response.json().catch(()=>({})) as {id?:string}
    const{error:markError}=await userClient.rpc('mark_quote_approval_email_sent',{p_user:userData.user.id,p_company:body.company_id,p_quote:body.quote_id,p_link:payload.link_id,p_provider_id:provider.id??null})
    if(markError){logFailure('sent_marker_failed');return json({sent:true,warning:'delivery_marker_failed'})}
    return json({sent:true})
  }catch{logFailure('unexpected_failure');return json({error:'email_unavailable'},502)}
})
