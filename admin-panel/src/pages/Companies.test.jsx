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
it('filters by relationship and legal form from the URL and links each card to its record',async()=>{
  mocks.modules={billing:true,planning:true}
  mocks.load.mockResolvedValue([
    {id:'client-a',company_id:'tenant-a',name:'Shared customer'},
    {id:'photo',company_id:'tenant-a',name:'Lucía Pérez',legal_form:'individual',is_client:false,is_collaborator:true,collaborator_role:'Fotografía'},
  ])
  await act(async()=>root.render(<MemoryRouter initialEntries={['/companies?relation=collaborators&type=individual']}><Companies/></MemoryRouter>))
  expect(host.textContent).toContain('Lucía Pérez')
  expect(host.textContent).not.toContain('Shared customer')
  expect(host.querySelector('a[href="/companies/photo"]')).not.toBeNull()
  expect(host.querySelector('button[aria-pressed="true"]').textContent).toBe('directory.collaborators')
  expect(host.textContent).toContain('directory.newCollaborator')
})
