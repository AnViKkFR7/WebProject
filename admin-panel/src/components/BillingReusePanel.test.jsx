// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import BillingReusePanel from './BillingReusePanel'
let root,host
beforeEach(()=>vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true))
afterEach(()=>{act(()=>root?.unmount());host?.remove()})
const render=props=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);act(()=>root.render(<BillingReusePanel loading={false} error={false} disabled={false} onRetry={()=>{}} onCreate={vi.fn()} t={key=>key} {...props}/>))}
const input=async(element,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))})
it('searches saved clients and copies the selected entry',()=>{
  const select=vi.fn();render({mode:'client',entries:[{id:'1',name:'Acme',tax_id:'B1',billing_address:'Madrid'}],onSelect:select})
  const search=host.querySelector('input[type=search]')
  return input(search,'acm').then(()=>{
  const result=[...host.querySelectorAll('button')].find(button=>button.textContent.includes('Acme'))
  act(()=>result.click())
  expect(select).toHaveBeenCalledWith(expect.objectContaining({name:'Acme',tax_id:'B1'}))
  })
})
it('creates a catalogue entry inline and applies the returned snapshot',async()=>{
  const created={id:'2',name:'Consultoría',description:'Sesión',unit:'hora',price:'90',tax:'21'}
  const create=vi.fn().mockResolvedValue(created),select=vi.fn();render({mode:'catalog',entries:[],onCreate:create,onSelect:select})
  act(()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='billingReuse.catalog.new').click())
  const values={name:'Consultoría',description:'Sesión',unit:'hora',price:'90',tax:'21'}
  for(const [key,value] of Object.entries(values)) {const element=[...host.querySelectorAll('label')].find(label=>label.textContent.startsWith(`billingReuse.catalog.${key}`)).querySelector('input');await input(element,value)}
  await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  expect(create).toHaveBeenCalledWith(values);expect(select).toHaveBeenCalledWith(created)
})
