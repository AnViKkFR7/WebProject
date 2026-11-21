import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {beforeAll,expect,it,vi} from 'vitest'
import {ownedItemMediaPath} from '../../supabase/functions/_shared/itemMediaStorage'

const project='https://project.example.test'
const base=`${project}/storage/v1/object/public/items-media/`
let code
beforeAll(async()=>{
  const source=await readFile(new URL('../../supabase/functions/delete-item-media/index.ts',import.meta.url),'utf8')
  code=(await transform(source,{loader:'ts',format:'cjs'})).code
})
async function removeMedia({url=`${base}company-a/item-a/image.png`,role='editor',active=true,memberCompany='company-a',token=true,dbError=false,moduleEnabled=true}={}) {
  const rpc=vi.fn(async()=>({data:moduleEnabled,error:null}))
  let handler
  const remove=vi.fn(async()=>({error:null}))
  const deleted=vi.fn()
  const client={rpc,auth:{getUser:async()=>({data:{user:{id:'user-a',app_metadata:{}}},error:null})},storage:{from:()=>({remove})},from:table=>{
    let deleting=false
    const filters={}
    const result=()=>({data:table==='company_members'?(active&&filters.is_active&&filters.company_id===memberCompany?{role}:null):{id:'media-a',item_id:'item-a',url_externa:url,items:{company_id:'company-a'}},error:null})
    const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query},single:async()=>result(),delete:()=>{deleting=true;deleted();return query},then:resolve=>Promise.resolve(deleting?{error:dbError?{message:'failed'}:null}:result()).then(resolve)}
    return query
  }}
  const require=name=>name.includes('server.ts')?{serve:fn=>{handler=fn}}:name.includes('supabase-js')?{createClient:()=>client}:{ownedItemMediaPath}
  new Function('require','Deno',code)(require,{env:{get:key=>key==='SUPABASE_URL'?project:'test-key'}})
  const response=await handler(new Request(`${project}/delete`,{method:'POST',headers:token?{Authorization:'Bearer test'}:{},body:JSON.stringify({media_id:'media-a'})}))
  return {response,body:await response.json(),remove,deleted,rpc}
}
it('deletes authorized media and defers its object to the transactional cleanup queue',async()=>{
  const result=await removeMedia()
  expect(result.response.status).toBe(200)
  expect(result.remove).not.toHaveBeenCalled()
  expect(result.body.cleanup).toBe('deferred')
})
it('never deletes another company or item object, including encoded and forged URLs',async()=>{
  for(const url of [`${base}company-b/item-b/image.png`,`${base}company-a/item-b/image.png`,`${base}company-a%2Fitem-a%2F..%2Fitem-b%2Fimage.png`,`${base}company-a/item-a/%252e%252e`,`${base}company-a/item-a/file%5Cother`,`${base}company-a/item-a/%zz`,`https://evil.test/items-media/company-a/item-a/image.png`]){
    const result=await removeMedia({url})
    expect(result.remove).not.toHaveBeenCalled()
    expect(result.body.warning).toBeTruthy()
  }
})
it('supports public and signed URLs, encoded canonical paths and ignores signing queries',()=>{
  for(const kind of ['public','sign','authenticated']) expect(ownedItemMediaPath(`${project}/storage/v1/object/${kind}/items-media/company-a%2Fitem-a%2Fphoto.png?token=test`,project,'company-a','item-a')).toBe('company-a/item-a/photo.png')
})
it('denies missing authentication, inactive members and viewers before any deletion',async()=>{
  for(const options of [{token:false},{active:false},{memberCompany:'company-b'},{role:'viewer'}]){
    const result=await removeMedia(options)
    expect([401,403]).toContain(result.response.status)
    expect(result.deleted).not.toHaveBeenCalled()
    expect(result.remove).not.toHaveBeenCalled()
  }
})
it('never removes an object when the database rejects the deletion',async()=>{
  const result=await removeMedia({dbError:true})
  expect(result.response.status).toBe(400)
  expect(result.remove).not.toHaveBeenCalled()
})
it('refuses to delete when the catalog module is disabled (service role skips the RLS module gate)',async()=>{
  const result=await removeMedia({moduleEnabled:false})
  expect(result.response.status).toBe(403)
  expect(result.rpc).toHaveBeenCalledWith('is_company_module_enabled',{_company_id:'company-a',_module_key:'items'})
  expect(result.deleted).not.toHaveBeenCalled()
  expect(result.remove).not.toHaveBeenCalled()
})
