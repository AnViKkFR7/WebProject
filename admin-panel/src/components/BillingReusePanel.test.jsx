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
it('shows at most three customer suggestions and narrows them as the user types',async()=>{
  const entries=['Alfa','Bravo','Charlie','Delta'].map((name,index)=>({id:String(index),name,tax_id:'X'+index,billing_address:'Madrid'}))
  render({mode:'client',entries,onSelect:vi.fn()})
  const search=host.querySelector('input[type=search]')
  act(()=>search.focus())
  expect(host.querySelectorAll('[role="option"]')).toHaveLength(3)
  await input(search,'del')
  expect([...host.querySelectorAll('[role="option"]')].map(option=>option.textContent)).toEqual(['DeltaX3 · Madrid'])
})
it('creates a catalogue entry inline and applies the returned snapshot',async()=>{
  const created={id:'2',name:'Consultoría',description:'Sesión',unit:'hora',price:'90',tax:'21'}
  const create=vi.fn().mockResolvedValue(created),select=vi.fn();render({mode:'catalog',entries:[],onCreate:create,onSelect:select})
  act(()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='billingReuse.catalog.new').click())
  const values={name:'Consultoría',description:'Sesión',unit:'hora',price:'90',tax:'21'}
  for(const [key,value] of Object.entries(values)) {const element=[...host.querySelectorAll('label')].find(label=>label.textContent.startsWith(`billingReuse.catalog.${key}`)).querySelector('input');await input(element,value)}
  host.querySelectorAll('input[type="number"]').forEach(element=>vi.spyOn(element,'checkValidity').mockReturnValue(true))
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='common.save').click())
  expect(create).toHaveBeenCalledWith(values);expect(select).toHaveBeenCalledWith(created)
})
it('creates a client without submitting the surrounding quote form',async()=>{
  const created={id:'client-2',company_id:'a',name:'Cliente prueba',tax_id:'B123',billing_address:'Calle Mayor 1'}
  const create=vi.fn().mockResolvedValue(created),select=vi.fn(),outerSubmit=vi.fn(event=>event.preventDefault())
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  act(()=>root.render(<form onSubmit={outerSubmit}><BillingReusePanel mode="client" entries={[]} loading={false} error={false} disabled={false} onRetry={()=>{}} onCreate={create} onSelect={select} t={key=>key}/></form>))
  act(()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='billingReuse.client.new').click())
  const values={name:'Cliente prueba',taxId:'B123',address:'Calle Mayor 1',email:'',phone:''}
  for(const [key,value] of Object.entries(values)){const element=[...host.querySelectorAll('label')].find(label=>label.textContent.startsWith(`billingReuse.client.${key}`)).querySelector('input');await input(element,value)}
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='common.save').click())
  expect(create).toHaveBeenCalledWith(values)
  expect(select).toHaveBeenCalledWith(created)
  expect(outerSubmit).not.toHaveBeenCalled()
})
