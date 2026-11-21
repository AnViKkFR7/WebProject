import {readFile} from 'node:fs/promises'
import {transform} from 'esbuild'
import {beforeAll,expect,it,vi} from 'vitest'
import * as trackCore from '../../company-site-snippet/lib/trackCore'
const a='123e4567-e89b-42d3-a456-426614174000',b='223e4567-e89b-42d3-a456-426614174000'
let code
beforeAll(async()=>{
  const source=await readFile(new URL('../../company-site-snippet/api/track.ts',import.meta.url),'utf8')
  code=(await transform(source,{loader:'ts',format:'cjs'})).code
})
function deployment({company=a,exists=true}={}){
  const queries=[]
  const insert=vi.fn(async()=>({error:null}))
  const rpc=vi.fn(async()=>({data:'test-daily-salt',error:null}))
  const from=vi.fn(table=>{
    const filters={};queries.push({table,filters})
    const result=()=>({data:table==='companies'?(exists?{id:filters.id}:null):[{key:'contact_click'}],error:null})
    const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query},maybeSingle:async()=>result(),then:resolve=>Promise.resolve(result()).then(resolve),insert}
    return query
  })
  const env={SUPABASE_URL:'https://project.example.test',SUPABASE_SERVICE_ROLE_KEY:'test-only',ANALYTICS_SALT:'test-only',VITE_COMPANY_ID:company}
  const module={exports:{}}
  const require=name=>name==='@supabase/supabase-js'?{createClient:()=>({from,rpc})}:trackCore
  new Function('require','module','exports','process',code)(require,module,module.exports,{env})
  const send=(companyId=a,fields={},headers={})=>module.exports.default(new Request('https://client.example/api/track',{
    method:'POST',headers:{'user-agent':'Mozilla/5.0','sec-fetch-site':'same-origin','host':'client.example',...headers},
    body:JSON.stringify({company_id:companyId,event_type:'page_view',path:'/services',...fields}),
  }))
  return {send,from,rpc,insert,queries}
}
it('rejects a different company before database access, even with same-origin headers',async()=>{
  const d=deployment()
  for(const fields of [{},{event_type:'cta_click',event_key:'contact_click'}]) expect((await d.send(b,fields)).status).toBe(204)
  expect(d.from).not.toHaveBeenCalled();expect(d.rpc).not.toHaveBeenCalled();expect(d.insert).not.toHaveBeenCalled()
})
it('fails closed when the configured company is absent or malformed',async()=>{
  for(const company of ['',undefined,'invalid',`${a}/other`]){
    const d=deployment({company:company===undefined?null:company})
    expect((await d.send()).status).toBe(204);expect(d.from).not.toHaveBeenCalled();expect(d.insert).not.toHaveBeenCalled()
  }
})
it('writes valid events with the configured company and server-derived visitor',async()=>{
  const d=deployment({company:` ${a.toUpperCase()} `})
  expect((await d.send(a.toUpperCase())).status).toBe(204)
  expect(d.queries).toContainEqual({table:'companies',filters:{id:a}})
  expect(d.insert).toHaveBeenCalledWith(expect.objectContaining({company_id:a,event_type:'page_view',path:'/services',visitor:expect.any(String)}))
})
it('scopes definitions and warm caches to the deployment and still rejects forged requests',async()=>{
  const d=deployment()
  await d.send(a,{event_type:'cta_click',event_key:'contact_click'})
  await d.send(b,{event_type:'cta_click',event_key:'contact_click'})
  await d.send(a,{event_type:'cta_click',event_key:'contact_click'})
  expect(d.queries.filter(q=>q.table==='analytics_event_definitions')).toEqual([{table:'analytics_event_definitions',filters:{company_id:a,is_active:true}}])
  expect(d.insert).toHaveBeenCalledTimes(2)
  for(const [event] of d.insert.mock.calls) expect(event.company_id).toBe(a)
})
it('supports separate deployments and never writes when the configured company does not exist',async()=>{
  const other=deployment({company:b});await other.send(b)
  expect(other.insert).toHaveBeenCalledWith(expect.objectContaining({company_id:b}))
  const missing=deployment({exists:false});await missing.send()
  expect(missing.rpc).not.toHaveBeenCalled();expect(missing.insert).not.toHaveBeenCalled()
})
it('retains origin, bot and event validation for the correct company',async()=>{
  const d=deployment()
  await d.send(a,{}, {'sec-fetch-site':'cross-site'})
  await d.send(a,{}, {'user-agent':'testbot'})
  await d.send(a,{event_type:'invalid'})
  expect(d.from).not.toHaveBeenCalled();expect(d.insert).not.toHaveBeenCalled()
})
