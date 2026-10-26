// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {es} from '../locales/es'
import BillingChapterTemplates from './BillingChapterTemplates'
let root,node
const t=key=>key.split('.').reduce((value,part)=>value?.[part],es) || key
const line={id:'a',chapter:'01 · Obra',description:'Trabajo',quantity:1,price:100,discount:0,tax:21}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);node=document.createElement('div');document.body.append(node);root=createRoot(node)})
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals()})
it('searches, applies and saves named chapter templates',async()=>{
  const apply=vi.fn(),save=vi.fn().mockResolvedValue({}),archive=vi.fn()
  await act(async()=>root.render(<BillingChapterTemplates templates={[{id:'t',name:'Reforma',lines:[line]}]} lines={[line]} loading={false} error={false} onApply={apply} onSave={save} onArchive={archive} t={t}/>))
  const inputs=node.querySelectorAll('input');const write=async(element,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))})
  await write(inputs[0],'Reforma')
  const result=[...node.querySelectorAll('button')].find(button=>button.textContent.includes('Reforma'));await act(async()=>result.click())
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({id:'t'}))
  await write(inputs[1],'Mi obra');await act(async()=>node.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  expect(save).toHaveBeenCalledWith({name:'Mi obra',lines:[line]})
})
