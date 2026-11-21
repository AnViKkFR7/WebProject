// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import RequireModule from './RequireModule'
const state=vi.hoisted(()=>({modules:{},loading:false,error:null,refresh:vi.fn()}))
vi.mock('../hooks/useCompanyModules',()=>({useCompanyModules:()=>state}))
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({t:key=>key})}))
let root,host
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  Object.assign(state,{modules:{},loading:false,error:null})
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()})
it.each([[true,false,true],[false,true,true],[true,true,true],[false,false,false]])('allows the directory with billing=%s, planning=%s: %s',async(billing,planning,visible)=>{
  state.modules={billing,planning}
  await act(async()=>root.render(<RequireModule module={['billing','planning']}><p>Directory</p></RequireModule>))
  expect(host.textContent.includes('Directory')).toBe(visible)
  expect(host.textContent.includes('modules.disabledTitle')).toBe(!visible)
})
it('retains single-module isolation even when the other module is enabled',async()=>{
  state.modules={billing:true,planning:false}
  await act(async()=>root.render(<RequireModule module="planning"><p>Tasks</p></RequireModule>))
  expect(host.textContent).not.toContain('Tasks')
})
it('waits for module loading and handles errors before rendering any children',async()=>{
  state.modules={billing:true};state.loading=true
  const view=<RequireModule module={['billing','planning']}><p>Directory</p></RequireModule>
  await act(async()=>root.render(view));expect(host.textContent).toBe('common.loading')
  state.loading=false;state.error=new Error('Unavailable')
  await act(async()=>root.render(<RequireModule module={['billing','planning']}><p>Directory</p></RequireModule>))
  expect(host.querySelector('[role="alert"]')).not.toBeNull()
  expect(host.textContent).not.toContain('Directory')
  await act(async()=>host.querySelector('button').click());expect(state.refresh).toHaveBeenCalledOnce()
})
