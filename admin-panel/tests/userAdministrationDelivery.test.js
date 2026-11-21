import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {beforeAll,expect,it,vi} from 'vitest'
import {listAuthUsers} from '../../supabase/functions/_shared/listAuthUsers'
const company='10000000-0000-4000-8000-000000000001'
let inviteCode,listCode
beforeAll(async()=>{
 for(const name of ['invite-user','listar-usuarios']){
  const code=(await transform(await readFile(new URL(`../../supabase/functions/${name}/index.ts`,import.meta.url),'utf8'),{loader:'ts',format:'cjs'})).code
  if(name==='invite-user')inviteCode=code;else listCode=code
 }
})
async function invite({role='admin',auth=true,existing=false,confirmed=false,ready=true,deliveryError=null,createError=false,markerError=false,claimError=null,canSend=true,oldDelivery='accepted'}={}){
 let handler
 const calls=[]
 const createUser=vi.fn(async()=>({data:createError?{}:{user:{id:'new-user'}},error:createError?new Error('private creation error'):null}))
 const inviteUserByEmail=vi.fn(async()=>({error:deliveryError}))
 const deleteUser=vi.fn()
 const client={auth:{getUser:async()=>({data:{user:{id:'actor',app_metadata:{app_role:role}}},error:null}),admin:{createUser,inviteUserByEmail,deleteUser}},rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==='claim_company_user_invitation')return{data:{id:'job',token:'token',user_id:existing?'existing-user':null,can_send:canSend,delivery:oldDelivery,membership:true},error:claimError}
  if(name==='attach_company_user_invitation')return{data:{ready,user_id:existing||createError?'existing-user':'new-user',confirmed},error:null}
  if(name==='finish_company_user_invitation')return{data:true,error:markerError?new Error('private marker error'):null}
  throw new Error('Unexpected RPC')
 }}
 const require=name=>name.includes('server.ts')?{serve:fn=>{handler=fn}}:{createClient:()=>client}
 new Function('require','Deno',inviteCode)(require,{env:{get:key=>({SUPABASE_URL:'https://project.example.test',SUPABASE_DB_KEY:'test',SITE_URL:'https://app.example.test'})[key]}})
 const response=await handler(new Request('https://project.example.test',{method:'POST',headers:auth?{Authorization:'Bearer test'}:{},body:JSON.stringify({company_id:company,email:' NEW@Example.Test ',full_name:'New User',role:'viewer'})}))
 return{status:response.status,body:await response.json(),calls,createUser,inviteUserByEmail,deleteUser}
}
it('reports account, membership and accepted email separately without claiming delivery',async()=>{
 const result=await invite()
 expect(result.body).toMatchObject({success:true,account:'exists',membership:true,delivery:'accepted'})
 expect(result.createUser).toHaveBeenCalledOnce()
 expect(result.inviteUserByEmail).toHaveBeenCalledWith('new@example.test',{redirectTo:'https://app.example.test/reset-password'})
 expect(result.deleteUser).not.toHaveBeenCalled()
})
it('preserves accounts and reports failed or uncertain mail as a partial result',async()=>{
 for(const status of [422,500]){
  const result=await invite({deliveryError:{status,message:'private SMTP response'}})
  expect(result.status).toBe(202)
  expect(result.body).toMatchObject({success:false,account:'exists',membership:true,delivery:status===500?'unknown':'failed'})
  expect(JSON.stringify(result.body)).not.toContain('private')
  expect(result.deleteUser).not.toHaveBeenCalled()
 }
})
it('never repeats completed requests or sends an invite to an already confirmed account',async()=>{
 const reused=await invite({existing:true,canSend:false})
 expect(reused.createUser).not.toHaveBeenCalled();expect(reused.inviteUserByEmail).not.toHaveBeenCalled()
 const linked=await invite({existing:true,confirmed:true})
 expect(linked.body.delivery).toBe('not_required');expect(linked.createUser).not.toHaveBeenCalled();expect(linked.inviteUserByEmail).not.toHaveBeenCalled()
})
it('recovers an ambiguous create result by resolving email, and does not send when membership is unavailable',async()=>{
 const recovered=await invite({createError:true})
 expect(recovered.body.success).toBe(true)
 expect(recovered.calls.find(c=>c.name==='attach_company_user_invitation').args.p_user).toBeNull()
 const blocked=await invite({existing:true,ready:false})
 expect(blocked.body).toMatchObject({success:false,membership:false})
 expect(blocked.inviteUserByEmail).not.toHaveBeenCalled();expect(blocked.deleteUser).not.toHaveBeenCalled()
})
it('marks acceptance as uncertain if persistence fails and blocks unauthorized or concurrent requests',async()=>{
 const uncertain=await invite({markerError:true})
 expect(uncertain.status).toBe(202);expect(uncertain.body.delivery).toBe('unknown')
 for(const options of [{auth:false},{role:'viewer'},{claimError:{code:'55P03'}}]){
  const result=await invite(options)
  expect([401,403,409]).toContain(result.status)
  expect(result.createUser).not.toHaveBeenCalled();expect(result.inviteUserByEmail).not.toHaveBeenCalled()
 }
})
it('reads beyond the first Auth page and deduplicates overlapping pages',async()=>{
 const pages=[[{id:'a'},{id:'b'}],[{id:'b'},{id:'c'}],[]]
 const listUsers=vi.fn(async({page})=>({data:{users:pages[page-1]},error:null}))
 expect((await listAuthUsers({auth:{admin:{listUsers}}},2)).map(user=>user.id)).toEqual(['a','b','c'])
 expect(listUsers).toHaveBeenNthCalledWith(2,{page:2,perPage:2})
})
it('fails instead of returning partial users on page errors, repeats or limits',async()=>{
 for(const mode of ['error','repeat','limit']){
  const listUsers=vi.fn(async({page})=>({data:{users:[{id:mode==='repeat'?'same':String(page)}]},error:mode==='error'&&page===2?new Error('private'):null}))
  await expect(listAuthUsers({auth:{admin:{listUsers}}},1,2)).rejects.toThrow()
 }
})
it('enforces platform administration in the actual list handler before querying any page',async()=>{
 for(const role of ['viewer','admin']){
  let handler
  const listUsers=vi.fn(async({page})=>({data:{users:page===1?Array.from({length:100},(_,i)=>({id:String(i)})):[{id:'last-user'}]},error:null}))
  const client={auth:{getUser:async()=>({data:{user:{app_metadata:{app_role:role}}},error:null}),admin:{listUsers}}}
  const require=name=>name.includes('server.ts')?{serve:fn=>{handler=fn}}:name.includes('supabase-js')?{createClient:()=>client}:{listAuthUsers}
  new Function('require','Deno',listCode)(require,{env:{get:()=> 'test'}})
  const response=await handler(new Request('https://project.example.test',{method:'POST',headers:{Authorization:'Bearer test'}}))
  if(role==='viewer'){expect(response.status).toBe(403);expect(listUsers).not.toHaveBeenCalled()}
  else{const body=await response.json();expect(body.users).toHaveLength(101);expect(body.users.at(-1).id).toBe('last-user')}
 }
})
