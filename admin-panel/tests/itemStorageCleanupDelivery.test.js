import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {beforeAll,expect,it,vi} from 'vitest'
import {ownedItemMediaPath} from '../../supabase/functions/_shared/itemMediaStorage'
const project='https://project.example.test',path='company-a/item-a/photo.png'
let code
beforeAll(async()=>{code=(await transform(await readFile(new URL('../../supabase/functions/cleanup-item-media/index.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'})).code})
async function run({secret='cleanup-test',jobUrl=`${project}/storage/v1/object/public/items-media/${path}`,storedPath=path,prepare=true,prepareError=false,storageError=false,markerError=false,claimError=false}={}){
 let handler,options
 const calls=[]
 const remove=vi.fn(async()=>({error:storageError?new Error('private storage response'):null}))
 const client={rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==='claim_item_storage_cleanup')return{data:[{id:'job',lease_token:'lease',company_id:'company-a',item_id:'item-a',url:jobUrl,path:storedPath}],error:claimError?new Error('private'):null}
  if(name==='prepare_item_storage_cleanup')return{data:prepare,error:prepareError?new Error('private'):null}
  if(name==='finish_item_storage_cleanup')return{data:true,error:markerError&&args.p_result==='done'?new Error('private'):null}
  throw new Error('Unexpected RPC')
 },storage:{from:bucket=>{expect(bucket).toBe('items-media');return{remove}}}}
 const require=name=>name.includes('server.ts')?{serve:fn=>{handler=fn}}:name.includes('supabase-js')?{createClient:(_url,_key,config)=>{options=config;return client}}:{ownedItemMediaPath}
 new Function('require','Deno',code)(require,{env:{get:key=>({SUPABASE_URL:project,SUPABASE_DB_KEY:'test-key',ITEM_MEDIA_CLEANUP_CRON_SECRET:'cleanup-test'})[key]}})
 const response=await handler(new Request(project,{method:'POST',headers:{'x-item-media-cleanup-secret':secret},body:JSON.stringify({path:'company-b/item-b/private.png'})}))
 return{status:response.status,body:await response.json(),calls,remove,options}
}
it('uses only owned queued paths, checks the lease before removal and marks completion',async()=>{
 const result=await run()
 expect(result.body).toEqual({cleaned:1,failed:0,review:0})
 expect(result.remove).toHaveBeenCalledWith([path])
 expect(result.calls.map(c=>c.name)).toEqual(['claim_item_storage_cleanup','prepare_item_storage_cleanup','finish_item_storage_cleanup'])
 expect(result.calls.at(-1).args).toEqual({p_id:'job',p_token:'lease',p_result:'done'})
 expect(typeof result.options.global.fetch).toBe('function')
})
it('rejects cron authentication before accessing any queue or object',async()=>{
 const result=await run({secret:'wrong'});expect(result.status).toBe(403)
 expect(result.calls).toEqual([]);expect(result.remove).not.toHaveBeenCalled()
})
it('never removes foreign, external or mismatched paths, regardless of service credentials',async()=>{
 for(const options of [{jobUrl:`${project}/storage/v1/object/public/items-media/company-b/item-b/private.png`},{jobUrl:`https://evil.test/storage/v1/object/public/items-media/${path}`},{storedPath:'company-b/item-b/private.png'}]){
  const result=await run(options);expect(result.remove).not.toHaveBeenCalled()
  expect(result.calls.at(-1).args.p_result).toBe('review')
 }
})
it('fails closed on shared references, expired tokens and validation errors',async()=>{
 for(const options of [{prepare:false},{prepareError:true}]){
  const result=await run(options);expect(result.remove).not.toHaveBeenCalled()
 }
})
it('keeps failures retryable both before and after object removal without sending private errors',async()=>{
 for(const options of [{storageError:true},{markerError:true}]){
  const result=await run(options)
  expect(result.body).toEqual({cleaned:0,failed:1,review:0})
  expect(result.calls.at(-1).args.p_result).toBe('retry')
  expect(JSON.stringify(result.body)).not.toContain('private')
 }
})
it('does not touch Storage when claiming fails',async()=>{
 const result=await run({claimError:true});expect(result.status).toBe(500);expect(result.remove).not.toHaveBeenCalled()
})
it('bounds outbound Supabase requests to 15 seconds',async()=>{
 const signal=new AbortController().signal
 const timeout=vi.spyOn(AbortSignal,'timeout').mockReturnValue(signal)
 const fetch=vi.fn(async()=>new Response('{}'))
 vi.stubGlobal('fetch',fetch)
 try{
  const result=await run()
  await result.options.global.fetch(project,{method:'DELETE'})
  expect(timeout).toHaveBeenCalledWith(15000)
  expect(fetch).toHaveBeenCalledWith(project,{method:'DELETE',signal})
 }finally{timeout.mockRestore();vi.unstubAllGlobals()}
})
