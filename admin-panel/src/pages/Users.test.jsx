// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { es } from '../locales/es'
const mocks=vi.hoisted(()=>({ role:'admin',manage:vi.fn(),confirm:vi.fn() }))
const members=[{ user_id:'me',full_name:'Admin',role:'admin',is_active:true },{ user_id:'other',full_name:'Other',role:'editor',is_active:true }]
vi.mock('../contexts/CompanyContext',()=>({ useCompany:()=>({ selectedCompany:{ id:'company-a',name:'Company A' } }) }))
vi.mock('../hooks/usePermissions',()=>({ usePermissions:()=>({ canAdministerPlatform:false,canManageMemberAccess:mocks.role === 'admin' }) }))
const translate=key=>key.split('.').reduce((value,k)=>value?.[k],es)||key
vi.mock('../contexts/LanguageContext',()=>({ useLanguage:()=>({ t:translate }) }))
vi.mock('../contexts/FeedbackContext',()=>({ useFeedback:()=>({ toast:{success:vi.fn(),error:vi.fn()},confirm:mocks.confirm }) }))
vi.mock('../components/users/UserAdminModal',()=>({default:()=>null}))
vi.mock('../services/companyService',()=>({ companyService:{ manageMemberAccess:(...args)=>mocks.manage(...args) } }))
vi.mock('../lib/supabaseClient',()=>({supabase:{ auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:()=>{
  const query={select:()=>query,eq:()=>query,single:async()=>({data:{role:mocks.role}}),then:resolve=>Promise.resolve({data:members,count:0}).then(resolve)}
  return query
}}}))
import Users from './Users'
let root,container
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.role='admin';mocks.manage.mockReset().mockResolvedValue();mocks.confirm.mockReset().mockResolvedValue(true)
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()})
const find=text=>[...container.querySelectorAll('button')].filter(item=>item.textContent===text)
it('lets a company admin suspend, reactivate and remove only other memberships',async()=>{
  await act(async()=>root.render(<Users/>))
  expect(find('Dar de baja')).toHaveLength(1)
  expect(find('Eliminar de la compañía')).toHaveLength(1)
  await act(async()=>find('Dar de baja')[0].click())
  expect(mocks.manage).toHaveBeenLastCalledWith('company-a','other','suspend')
  expect(find('Reactivar')).toHaveLength(1)
  await act(async()=>find('Reactivar')[0].click())
  expect(mocks.manage).toHaveBeenLastCalledWith('company-a','other','reactivate')
  await act(async()=>find('Eliminar de la compañía')[0].click())
  expect(mocks.confirm).toHaveBeenLastCalledWith(expect.objectContaining({danger:true,message:expect.stringContaining('Se conservarán sus documentos')}))
  expect(mocks.manage).toHaveBeenLastCalledWith('company-a','other','remove')
  expect(container.textContent).not.toContain('Other')
})
it('hides access-management actions from editors and honors cancelled confirmations',async()=>{
  mocks.role='editor';await act(async()=>root.render(<Users/>))
  expect(find('Dar de baja')).toHaveLength(0);expect(find('Eliminar de la compañía')).toHaveLength(0)
  mocks.role='admin';await act(async()=>root.render(<Users/>))
  mocks.confirm.mockResolvedValue(false)
  await act(async()=>find('Dar de baja')[0].click())
  expect(mocks.manage).not.toHaveBeenCalled()
})
