// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import Companies from './Companies'
const mocks=vi.hoisted(()=>({modules:{billing:true,planning:false},load:vi.fn(),company:{id:'tenant-a'}}))
vi.mock('../services/clientCompanyService',()=>({getClientCompaniesByCompany:mocks.load,createClientCompany:vi.fn(),updateClientCompany:vi.fn(),deleteClientCompany:vi.fn(),getClientCompanyUsage:vi.fn()}))
vi.mock('../contexts/CompanyContext',()=>({useCompany:()=>({selectedCompany:mocks.company})}))
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({t:key=>key})}))
vi.mock('../contexts/FeedbackContext',()=>({useFeedback:()=>({toast:{},confirm:vi.fn()})}))
vi.mock('../hooks/usePermissions',()=>({usePermissions:()=>({canEdit:true})}))
vi.mock('../hooks/useCompanyModules',()=>({useCompanyModules:()=>({modules:mocks.modules})}))
vi.mock('../components/planning/ClientCompanyModal',()=>({default:()=>null}))
let root,host
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  mocks.load.mockResolvedValue([{id:'client-a',company_id:'tenant-a',name:'Shared customer'}])
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();vi.unstubAllGlobals()})
it.each([false,true])('shows the shared directory and only offers Planning when it is enabled (%s)',async(planning)=>{
  mocks.modules={billing:true,planning}
  await act(async()=>root.render(<MemoryRouter><Companies/></MemoryRouter>))
  expect(mocks.load).toHaveBeenCalledWith('tenant-a')
  expect(host.textContent).toContain('Shared customer')
  expect(Boolean(host.querySelector('a[href="/planning"]'))).toBe(planning)
})
