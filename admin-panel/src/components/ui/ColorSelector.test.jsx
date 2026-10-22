// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../../contexts/LanguageContext',()=>({ useLanguage:()=>({ t:key=>key }) }))
import ColorSelector from './ColorSelector'
let root,container
afterEach(async()=>{ await act(async()=>root?.unmount()); container?.remove(); vi.unstubAllGlobals() })
it('provides ten keyboard-accessible swatches and a validated manual HEX field without a native picker',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
  function Harness() { const [color,setColor]=useState('#635bff'); return <ColorSelector label="Color" value={color} onChange={setColor}/> }
  await act(async()=>root.render(<Harness/>))
  const buttons=container.querySelectorAll('button')
  expect(buttons).toHaveLength(10)
  expect(container.querySelector('input[type="color"]')).toBeNull()
  expect(buttons[0].getAttribute('aria-pressed')).toBe('true')
  await act(async()=>buttons[2].click())
  const input=container.querySelector('input')
  expect(input.value).toBe('#0891b2')
  expect(buttons[2].getAttribute('aria-pressed')).toBe('true')
  const change=async value=>act(async()=>{ Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{ bubbles:true })); input.dispatchEvent(new Event('change',{ bubbles:true })) })
  await change('#aBc123'); expect(input.checkValidity()).toBe(true)
  await change('#zzzzzz'); expect(input.checkValidity()).toBe(false)
})
