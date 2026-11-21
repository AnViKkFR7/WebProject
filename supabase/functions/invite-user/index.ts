import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const auth=req.headers.get('Authorization')
 if(!auth?.startsWith('Bearer '))return json({error:'unauthorized'},401)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_DB_KEY')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),site=Deno.env.get('SITE_URL')
 if(!url||!key||!site)return json({error:'missing_configuration'},500)
 let redirect:string
 try{const parsed=new URL(site);if(!['https:','http:'].includes(parsed.protocol)||parsed.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)||parsed.username||parsed.password)throw new Error();redirect=new URL('/reset-password',parsed).href}catch{return json({error:'invalid_site_url'},500)}
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}})
 let job:any=null
 let accountId:string|null=null
 let membership=false
 let sending=false
 try{
  const{data:{user},error}=await admin.auth.getUser(auth.slice(7))
  if(error||!user)return json({error:'unauthorized'},401)
  if(user.app_metadata?.app_role!=='admin')return json({error:'forbidden'},403)
  const body=await req.json().catch(()=>null)
  if(!body||typeof body.email!=='string'||typeof body.full_name!=='string'||typeof body.company_id!=='string'||!['editor','viewer'].includes(body.role)||!/^[0-9a-f-]{36}$/i.test(body.company_id)||body.resend!==undefined&&typeof body.resend!=='boolean')return json({error:'invalid_invitation'},400)
  const email=body.email.trim().toLowerCase(),name=body.full_name.trim()
  const claimed=await admin.rpc('claim_company_user_invitation',{p_actor:user.id,p_company:body.company_id,p_email:email,p_name:name,p_role:body.role,p_resend:body.resend===true})
  if(claimed.error)return json({error:claimed.error.code==='55P03'?'invitation_busy':'invitation_unavailable'},claimed.error.code==='55P03'?409:400)
  job=claimed.data
  if(!job?.id)return json({error:'invitation_unavailable'},500)
  if(!job.can_send)return json({success:job.membership===true&&['accepted','not_required'].includes(job.delivery),user:{id:job.user_id},account:job.user_id?'exists':'pending',membership:job.membership===true,delivery:job.delivery,can_retry:true},['accepted','not_required'].includes(job.delivery)?200:202)
  accountId=job.user_id??null
  if(!accountId){
   const created=await admin.auth.admin.createUser({email,email_confirm:false,user_metadata:{full_name:name}})
   accountId=created.data?.user?.id??null
   // If creation returned an ambiguous error, resolve the unique email inside
   // the attach RPC before deciding it failed. Never delete an Auth account.
  }
  const attached=await admin.rpc('attach_company_user_invitation',{p_id:job.id,p_token:job.token,p_user:accountId})
  if(attached.error)throw new Error('membership_unavailable')
  accountId=attached.data?.user_id??accountId
  membership=attached.data?.ready===true
  if(!membership){
   await admin.rpc('finish_company_user_invitation',{p_id:job.id,p_token:job.token,p_delivery:'failed'})
   return json({success:false,user:{id:accountId},account:accountId?'exists':'pending',membership:false,delivery:'failed',can_retry:true},202)
  }
  let delivery='not_required'
  if(!attached.data.confirmed){
   sending=true
   const invite=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:redirect})
   delivery=invite.error?(invite.error.status>=500||!invite.error.status?'unknown':'failed'):'accepted'
  }
  const finished=await admin.rpc('finish_company_user_invitation',{p_id:job.id,p_token:job.token,p_delivery:delivery})
  if(finished.error||finished.data!==true)throw new Error('marker_unavailable')
  return json({success:['accepted','not_required'].includes(delivery),user:{id:accountId},account:'exists',membership:true,delivery,can_retry:true},['accepted','not_required'].includes(delivery)?200:202)
 }catch{
  if(job?.token){try{await admin.rpc('finish_company_user_invitation',{p_id:job.id,p_token:job.token,p_delivery:sending?'unknown':'failed'})}catch{/* Keep the lease for conservative recovery. */}}
  return json({success:false,account:accountId?'exists':'pending',membership,delivery:sending?'unknown':'failed',can_retry:true},job?202:500)
 }
})
