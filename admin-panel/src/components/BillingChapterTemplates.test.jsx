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
  await write(inputs[1],'Mi obra');await act(async()=>[...node.querySelectorAll('button')].find(button=>button.textContent===es.chapterTemplates.save).click())
  expect(save).toHaveBeenCalledWith({name:'Mi obra',lines:[line]})
})
const write=async(element,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))})
const saveButton=()=>[...node.querySelectorAll('button')].find(button=>button.textContent===es.chapterTemplates.save)
async function insideEditor({onSave=vi.fn().mockResolvedValue({}),disabled=false}={}){
  const persist=vi.fn(event=>event.preventDefault())
  await act(async()=>root.render(<form id="quote-editor" onSubmit={persist}><input name="customer" required defaultValue="Client"/><BillingChapterTemplates templates={[]} lines={[line]} disabled={disabled} onSave={onSave} t={t}/><button type="submit">Save quote</button></form>))
  return {persist,onSave,name:node.querySelectorAll('section input')[1],search:node.querySelector('input[type=search]'),form:node.querySelector('form')}
}
it('saves via button and Enter without submitting the enclosing quote or nesting forms',async()=>{
  const {persist,onSave,name}=await insideEditor()
  expect(node.querySelectorAll('form')).toHaveLength(1)
  await write(name,'First');await act(async()=>saveButton().click())
  await write(name,'Second');await act(async()=>name.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})))
  expect(onSave.mock.calls.map(([value])=>value.name)).toEqual(['First','Second'])
  expect(persist).not.toHaveBeenCalled()
})
it('keeps template fields out of quote validity and still allows explicit quote submission',async()=>{
  const {persist,onSave,name,search,form}=await insideEditor()
  expect(name.getAttribute('form')).toBe('');expect(search.getAttribute('form')).toBe('')
  expect(name.required).toBe(false)
  expect(form.checkValidity()).toBe(true)
  await act(async()=>search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})))
  expect(persist).not.toHaveBeenCalled();expect(onSave).not.toHaveBeenCalled()
  await act(async()=>[...node.querySelectorAll('button')].find(button=>button.textContent==='Save quote').click())
  expect(persist).toHaveBeenCalledTimes(1)
})
it('validates the local name and retains it after a failed save for retry',async()=>{
  const onSave=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({})
  const {name,persist}=await insideEditor({onSave})
  await write(name,'   ');await act(async()=>saveButton().click());expect(onSave).not.toHaveBeenCalled()
  expect(node.querySelector('[role=alert]').textContent).toBe(es.chapterTemplates.invalidName)
  await write(name,'Keep this');await act(async()=>saveButton().click())
  expect(name.value).toBe('Keep this');expect(node.textContent).toContain(es.chapterTemplates.saveError)
  await act(async()=>saveButton().click());expect(onSave).toHaveBeenCalledTimes(2);expect(name.value).toBe('')
  expect(persist).not.toHaveBeenCalled()
})
it('blocks disabled actions and duplicate saves while a request is pending',async()=>{
  let resolve
  const onSave=vi.fn(()=>new Promise(done=>{resolve=done}))
  const {name}=await insideEditor({onSave})
  await write(name,'Pending')
  await act(async()=>{for(let n=0;n<2;n++)name.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))})
  expect(onSave).toHaveBeenCalledTimes(1)
  await act(async()=>resolve({}))
  const disabled=await insideEditor({onSave,disabled:true})
  await write(disabled.name,'Disabled')
  await act(async()=>disabled.name.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})))
  expect(onSave).toHaveBeenCalledTimes(1)
})
