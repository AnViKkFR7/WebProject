// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../locales/es'
vi.mock('../../contexts/LanguageContext',()=>({ useLanguage:()=>({ t:key=>key.split('.').reduce((value,k)=>value?.[k],es)||key }) }))
import TaskFormModal from './TaskFormModal'
let root;let container;let close;let submit
function Harness(){
  const [form,setForm]=useState({title:'Prepare proposal',description:'Scope and timing',client_company_id:'client',type:'todo',is_all_day:false,start_datetime:'2026-10-22T09:00',end_datetime:'2026-10-22T10:00',recurrence_type:'none',recurrence_value:null,reminders:[]})
  return <TaskFormModal open form={form} setForm={setForm} clientCompanies={[{id:'client',name:'Client'}]} files={[]} existingAttachments={[]} onFilesChange={()=>{}} onRemoveExisting={()=>{}} onSubmit={submit} onClose={close}/>
}
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  close=vi.fn();submit=vi.fn(e=>e.preventDefault())
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
  await act(async()=>root.render(<Harness/>))
})
afterEach(async()=>{ await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals() })
const click=async element=>{ await act(async()=>element.click()) }
describe('planning form layout preserves native form behavior',()=>{
  it('keeps all original controls and submits from the external modal footer',async()=>{
    expect(document.getElementById('task-title').required).toBe(true)
    expect(document.getElementById('task-company').value).toBe('client')
    expect(document.querySelector('input[type="file"]').multiple).toBe(true)
    expect(document.querySelectorAll('[type="checkbox"]')).toHaveLength(4)
    const save=document.querySelector('button[form="planning-task-form"]')
    await click(save)
    expect(submit).toHaveBeenCalledTimes(1)
  })
  it('retains the all-day and recurrence controls inside their new sections',async()=>{
    await click(document.querySelectorAll('[role="switch"]')[0])
    expect(document.getElementById('task-date').value).toBe('22/10/2026')
    await click(document.querySelectorAll('[role="switch"]')[1])
    expect(document.querySelector('input[aria-label="Repetir cada"]') || document.querySelector('input[type="number"]')).toBeTruthy()
  })
  it('retains Escape dismissal and restores body scrolling',async()=>{
    expect(document.body.style.overflow).toBe('hidden')
    await act(async()=>document.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
    expect(close).toHaveBeenCalledTimes(1)
    await act(async()=>root.render(null))
    expect(document.body.style.overflow).not.toBe('hidden')
  })
  it('follows start edits by an hour, preserves custom ends and offers a one-hour reset',async()=>{
    const times=document.querySelectorAll('input[type="time"]')
    const enter=async(input,value)=>act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value)
      input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))
    })
    await enter(times[0],'15:30')
    expect(times[1].value).toBe('16:30')
    await enter(times[1],'18:45')
    await enter(times[0],'16:00')
    expect(times[1].value).toBe('18:45')
    await click(document.querySelector('.task-hour-shortcut'))
    expect(times[1].value).toBe('17:00')
    expect(document.querySelector('.task-duration').textContent).toContain('1 h')
  })
})
