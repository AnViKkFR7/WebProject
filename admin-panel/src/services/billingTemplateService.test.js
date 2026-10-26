import {beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),filters:[]}))
vi.mock('../lib/supabaseClient',()=>({supabase:{from:mocks.from,rpc:mocks.rpc}}))
import {archiveBillingChapterTemplate,loadBillingChapterTemplates,saveBillingChapterTemplate} from './billingTemplateService'
const template={id:'t1',company_id:'a',name:'Reforma',lines:[{chapter:'01',description:'Trabajo',quantity:1,price:20,discount:0,tax:21}]}
beforeEach(()=>{mocks.from.mockReset();mocks.rpc.mockReset();mocks.filters.length=0})
it('loads active templates in the selected company and rejects crossed responses',async()=>{
  mocks.from.mockImplementation(()=>{const builder={select:()=>builder,eq:(key,value)=>{mocks.filters.push([key,value]);return builder},is:(key,value)=>{mocks.filters.push([key,value]);return builder},order:()=>builder,limit:async()=>({data:[template],error:null})};return builder})
  expect(await loadBillingChapterTemplates('a')).toEqual([template]);expect(mocks.filters).toContainEqual(['archived_at',null])
  mocks.from.mockImplementation(()=>{const builder={select:()=>builder,eq:()=>builder,is:()=>builder,order:()=>builder,limit:async()=>({data:[{...template,company_id:'b'}],error:null})};return builder})
  await expect(loadBillingChapterTemplates('a')).rejects.toThrow('Invalid chapter template scope')
})
it('saves and archives only through company-scoped RPCs',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:template,error:null})
  expect(await saveBillingChapterTemplate('a',{name:'Reforma',lines:template.lines})).toEqual(template)
  expect(mocks.rpc).toHaveBeenNthCalledWith(1,'save_billing_chapter_template',{p_company:'a',p_name:'Reforma',p_lines:template.lines})
  mocks.rpc.mockResolvedValueOnce({data:null,error:null});await archiveBillingChapterTemplate('a','t1')
  expect(mocks.rpc).toHaveBeenNthCalledWith(2,'archive_billing_chapter_template',{p_company:'a',p_id:'t1'})
})
