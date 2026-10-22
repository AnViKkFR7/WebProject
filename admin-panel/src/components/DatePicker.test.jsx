// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach,afterEach,it,expect,vi } from 'vitest'
import { es } from '../locales/es'
vi.mock('../contexts/LanguageContext',()=>({ useLanguage:()=>({language:'es',t:key=>key.split('.').reduce((value,k)=>value?.[k],es)||key}) }))
import DatePicker from './DatePicker'
import Modal from './ui/Modal'
let container,root,changed,closed
function Harness({min,required=false}) {
  const [date,setDate]=useState('2026-10-22')
  return <Modal open title="Form" onClose={closed}><form><DatePicker id="date" label="Fecha inicio" value={date} min={min} required={required} onChange={value=>{changed(value);setDate(value)}}/><button type="submit">Save</button></form></Modal>
}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);changed=vi.fn();closed=vi.fn();container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()})
const render=async props=>act(async()=>root.render(<Harness {...props}/>))
const click=async node=>act(async()=>node.click())
const button=label=>[...document.querySelectorAll('button')].find(node=>node.getAttribute('aria-label')===label || node.textContent===label)
const enter=async value=>act(async()=>{const input=document.getElementById('date');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})
it('opens on the selected month, starts weeks on Monday and emits ISO dates',async()=>{
  await render();await click(button('Abrir calendario: Fecha inicio'))
  expect(document.querySelector('.calendar-month-nav select').value).toBe('9')
  expect(document.querySelector('.calendar-days button').dataset.date).toBe('2026-09-28')
  await click(document.querySelector('[data-date="2026-10-26"]'))
  expect(changed).toHaveBeenCalledWith('2026-10-26')
  expect(document.getElementById('date').value).toBe('26/10/2026')
  expect(document.querySelector('.calendar-popover')).toBeNull()
})
it('validates typed dates and honors required and min without saving stale valid values',async()=>{
  await render({required:true,min:'2026-10-22'})
  await enter('31/02/2026');expect(document.getElementById('date').checkValidity()).toBe(false);expect(changed).not.toHaveBeenCalled()
  await enter('21/10/2026');expect(document.getElementById('date').checkValidity()).toBe(false)
  await enter('23/10/2026');expect(changed).toHaveBeenCalledWith('2026-10-23');expect(document.getElementById('date').checkValidity()).toBe(true)
  await enter('');expect(document.getElementById('date').checkValidity()).toBe(false)
  await click(button('Abrir calendario: Fecha inicio'))
  expect(document.querySelector('[data-date="2026-10-21"]').disabled).toBe(true)
  expect(button('Borrar')).toBeUndefined()
})
it('closes just the calendar on Escape and supports keyboard navigation',async()=>{
  await render();await click(button('Abrir calendario: Fecha inicio'))
  await act(async()=>document.querySelector('[data-date="2026-10-22"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})))
  expect(document.querySelector('[data-date="2026-10-23"]').tabIndex).toBe(0)
  await act(async()=>document.querySelector('[data-date="2026-10-23"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
  expect(document.querySelector('.calendar-popover')).toBeNull()
  expect(closed).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(button('Abrir calendario: Fecha inicio'))
})
