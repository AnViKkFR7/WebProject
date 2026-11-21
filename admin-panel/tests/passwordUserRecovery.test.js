import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {beforeAll,expect,it,vi} from 'vitest'
let code
beforeAll(async()=>{code=(await transform(await readFile(new URL('../../supabase/functions/create-user/index.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'})).code})
async function run({existing=false,createError=false,attachError=false,markerError=false,claimError=false,role='admin'}={}){
 let handler
 const createUser=vi.fn(async()=>({data:createError?{}:{user:{id:'created'}},error:createError?{}:null}))
 const deleteUser=vi.fn(),updateUserById=vi.fn()
 const rpc=vi.fn(async name=>{
  if(name==='claim_company_user_invitation')return{data:{id:'job',token:'lease',user_id:existing?'existing':null},error:claimError?{}:null}
  if(name==='attach_company_user_invitation')return{data:{ready:true,user_id:'resolved',confirmed:true},error:attachError?{}:null}
  return{data:true,error:markerError?{}:null}
 })
 const client={rpc,auth:{getUser:async()=>({data:{user:{id:'admin',app_metadata:{app_role:role}}}}),admin:{createUser,deleteUser,updateUserById}}}
 new Function('require','Deno',code)(name=>name.includes('server.ts')?{serve:fn=>handler=fn}:{createClient:()=>client},{env:{get:()=> 'test'}})
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer token'},body:JSON.stringify({email:'a@example.test',password:'StrongPass123!',full_name:'Person',company_id:'company',role:'viewer'})}))
 return{body:await response.json(),status:response.status,createUser,deleteUser,updateUserById,rpc}
}
it('validates operator and company before creating credentials',async()=>{
 for(const options of [{role:'viewer'},{claimError:true}]){const r=await run(options);expect(r.status).toBeGreaterThanOrEqual(400);expect(r.createUser).not.toHaveBeenCalled()}
})
it('never deletes accounts when membership or confirmation fails',async()=>{
 for(const options of [{attachError:true},{markerError:true}]){const r=await run(options);expect(r.status).toBe(202);expect(r.body.success).toBe(false);expect(r.deleteUser).not.toHaveBeenCalled()}
})
it('recovers by email without replacing existing credentials or claiming a new password',async()=>{
 for(const options of [{existing:true},{createError:true}]){const r=await run(options);expect(r.body).toMatchObject({success:true,password_created:false});expect(r.updateUserById).not.toHaveBeenCalled();expect(r.deleteUser).not.toHaveBeenCalled()}
 const r=await run();expect(r.body.password_created).toBe(true)
})
