import {beforeEach,it,expect,vi} from 'vitest'
import {billingPalettes} from '../lib/billingAppearance'
const mocks=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),filters:[]}))
vi.mock('../lib/supabaseClient',()=>({supabase:{from:mocks.from,rpc:mocks.rpc}}))
import {loadBillingPalettes,saveBillingPalette} from './billingPaletteService'
const entry={id:'p1',company_id:'a',name:'Arena',palette:{...billingPalettes[0],id:'custom'}}
beforeEach(()=>{mocks.from.mockReset();mocks.rpc.mockReset();mocks.filters.length=0})
function rows(values) {
  mocks.from.mockImplementation(()=>{
    const builder={select:()=>builder,eq:(key,value)=>{mocks.filters.push([key,value]);return builder},order:()=>builder,range:async(start,end)=>({data:values.slice(start,end+1),error:null})}
    return builder
  })
}
it('filters every page of the palette library by company and rejects foreign responses',async()=>{
  rows(Array.from({length:501},(_,index)=>({...entry,id:String(index)})))
  expect(await loadBillingPalettes('a')).toHaveLength(501)
  expect(mocks.filters).toEqual([['company_id','a'],['company_id','a']])
  rows([{...entry,company_id:'b'}])
  await expect(loadBillingPalettes('a')).rejects.toThrow('Invalid palette library')
})
it('saves only named custom palettes through the RPC and propagates errors without mutating colors',async()=>{
  mocks.rpc.mockResolvedValue({data:entry,error:null})
  const palette=structuredClone(entry.palette)
  expect(await saveBillingPalette('a',' Arena ',palette)).toEqual(entry)
  expect(mocks.rpc).toHaveBeenCalledWith('save_billing_color_palette',{p_company:'a',p_name:'Arena',p_palette:palette})
  expect(palette).toEqual(entry.palette)
  for(const name of ['', ' ', 'x'.repeat(61),'bad\nname'])await expect(saveBillingPalette('a',name,palette)).rejects.toThrow('Invalid palette')
  await expect(saveBillingPalette('a','Preset',billingPalettes[0])).rejects.toThrow('Invalid palette')
  mocks.rpc.mockResolvedValue({data:null,error:{code:'23505'}})
  await expect(saveBillingPalette('a','Arena',palette)).rejects.toMatchObject({code:'23505'})
})
it('rejects another company in the RPC result',async()=>{
  mocks.rpc.mockResolvedValue({data:{...entry,company_id:'b'},error:null})
  await expect(saveBillingPalette('a','Arena',entry.palette)).rejects.toThrow('Invalid saved palette')
})
