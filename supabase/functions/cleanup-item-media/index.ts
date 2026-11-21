import {serve} from 'https://deno.land/std@0.168.0/http/server.ts'
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {ownedItemMediaPath} from '../_shared/itemMediaStorage.ts'
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const secret=Deno.env.get('ITEM_MEDIA_CLEANUP_CRON_SECRET')
 if(!secret||req.headers.get('x-item-media-cleanup-secret')!==secret)return json({error:'forbidden'},403)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_DB_KEY')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return json({error:'missing_configuration'},500)
 const admin=createClient(url,key,{global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}})
 const{data:jobs,error}=await admin.rpc('claim_item_storage_cleanup',{p_limit:20})
 if(error)return json({error:'queue_unavailable'},500)
 let cleaned=0,failed=0,review=0
 for(const job of jobs??[]){
  const finish=async(result:string)=>{
   const{data,error}=await admin.rpc('finish_item_storage_cleanup',{p_id:job.id,p_token:job.lease_token,p_result:result})
   if(error||data!==true)throw new Error('marker_failed')
  }
  try{
   const path=ownedItemMediaPath(job.url,url,job.company_id,job.item_id)
   if(!path||path!==job.path){await finish('review');review++;continue}
   const{data:allowed,error}=await admin.rpc('prepare_item_storage_cleanup',{p_id:job.id,p_token:job.lease_token})
   if(error)throw new Error('validation_failed')
   if(allowed!==true){review++;continue}
   const{error:removeError}=await admin.storage.from('items-media').remove([path])
   if(removeError)throw new Error('storage_failed')
   await finish('done');cleaned++
  }catch{
   failed++
   try{await finish('retry')}catch{console.error('[ITEM-STORAGE-CLEANUP] recovery_pending')}
  }
 }
 return json({cleaned,failed,review})
})
