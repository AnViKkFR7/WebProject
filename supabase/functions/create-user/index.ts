import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const token=req.headers.get('Authorization')
 if(!token?.startsWith('Bearer '))return json({error:'unauthorized'},401)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return json({error:'missing_configuration'},500)
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}})
 let job:any=null
 try{
  const{data:{user},error}=await admin.auth.getUser(token.slice(7))
  if(error||!user)return json({error:'unauthorized'},401)
  if(user.app_metadata?.app_role!=='admin')return json({error:'forbidden'},403)
  const body=await req.json().catch(()=>null)
  if(!body||typeof body.email!=='string'||typeof body.full_name!=='string'||typeof body.company_id!=='string'||!['editor','viewer'].includes(body.role)||typeof body.password!=='string'||body.password.length<10||body.password.length>128||!/[A-Z]/.test(body.password)||!/[a-z]/.test(body.password)||!/[0-9]/.test(body.password)||!/[!@#$%^&*()_+=\x5b\x5d{}|;:,.<>?-]/.test(body.password))return json({error:'invalid_user'},400)
  const email=body.email.trim().toLowerCase()
  // Persistent company/email lease validates company and operator before Auth.
  const claim=await admin.rpc('claim_company_user_invitation',{p_actor:user.id,p_company:body.company_id,p_email:email,p_name:body.full_name.trim(),p_role:body.role,p_resend:true})
  if(claim.error)return json({error:claim.error.code==='55P03'?'invitation_busy':'user_unavailable'},409)
  job=claim.data
  if(!job?.token)return json({error:'user_unavailable'},409)
  let accountId=job.user_id??null
  let passwordCreated=false
  if(!accountId){
   const created=await admin.auth.admin.createUser({email,password:body.password,email_confirm:true,user_metadata:{full_name:body.full_name.trim()}})
   accountId=created.data?.user?.id??null
   passwordCreated=!!accountId&&!created.error
  }
  // Also resolves a successful creation whose HTTP response was lost. Never
  // reset an existing password or delete an account as compensation.
  const attached=await admin.rpc('attach_company_user_invitation',{p_id:job.id,p_token:job.token,p_user:accountId})
  if(attached.error||!attached.data?.ready)throw new Error('membership_pending')
  const finished=await admin.rpc('finish_company_user_invitation',{p_id:job.id,p_token:job.token,p_delivery:'not_required'})
  if(finished.error||finished.data!==true)throw new Error('marker_pending')
  return json({success:true,membership:true,password_created:passwordCreated,user:{id:attached.data.user_id},confirmed:attached.data.confirmed})
 }catch{
  if(job?.token){try{await admin.rpc('finish_company_user_invitation',{p_id:job.id,p_token:job.token,p_delivery:'failed'})}catch{/* Lease expiry permits a later explicit retry. */}}
  return json({success:false,membership:false,error:'user_creation_pending'},job?202:500)
 }
})
