import {beforeEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),filters:[]}))
vi.mock('../lib/supabaseClient',()=>({supabase:{from:mocks.from,rpc:mocks.rpc}}))
import {archiveBillingCatalogItem,loadBillingReuse,saveBillingClient,saveBillingCatalogItem} from './billingReuseService'
const client={id:'client',company_id:'a',name:'Cliente'}
const item={id:'item',company_id:'a',name:'Servicio',price:'20.00',tax:'21.00'}
beforeEach(()=>{mocks.from.mockReset();mocks.rpc.mockReset();mocks.filters.length=0})
it('loads only active client and catalogue rows for the selected company',async()=>{
  mocks.from.mockImplementation(table=>{
    const rows=table==='client_company'?[client]:[item]
    const builder={select:()=>builder,eq:(key,value)=>{mocks.filters.push([table,key,value]);return builder},is:(key,value)=>{mocks.filters.push([table,key,value]);return builder},order:async()=>({data:rows,error:null})}
    return builder
  })
  expect(await loadBillingReuse('a')).toEqual({clients:[client],catalog:[item]})
  expect(mocks.filters).toContainEqual(['client_company','company_id','a'])
  expect(mocks.filters).toContainEqual(['billing_catalog_items','archived_at',null])
})
it('rejects cross-company rows and saves new entries only through scoped RPCs',async()=>{
  mocks.from.mockImplementation(()=>{const builder={select:()=>builder,eq:()=>builder,is:()=>builder,order:async()=>({data:[{...client,company_id:'b'}],error:null})};return builder})
  await expect(loadBillingReuse('a')).rejects.toThrow('Invalid client response')
  mocks.rpc.mockResolvedValueOnce({data:client,error:null}).mockResolvedValueOnce({data:item,error:null})
  await saveBillingClient('a',{name:'Cliente',taxId:'B',address:'Calle',email:'',phone:''})
  await saveBillingCatalogItem('a',{name:'Servicio',description:'Detalle',unit:'hora',price:'20',tax:'21'})
  expect(mocks.rpc).toHaveBeenNthCalledWith(1,'save_client_company',expect.objectContaining({p_company:'a',p_name:'Cliente',p_tax_id:'B'}))
  expect(mocks.rpc).toHaveBeenNthCalledWith(2,'save_billing_catalog_item',expect.objectContaining({p_company:'a',p_name:'Servicio',p_unit:'hora'}))
  mocks.rpc.mockResolvedValueOnce({data:null,error:null})
  await archiveBillingCatalogItem('a','item')
  expect(mocks.rpc).toHaveBeenLastCalledWith('archive_billing_catalog_item',{p_company:'a',p_id:'item'})
})
