// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import CrmPrivacy from './CrmPrivacy'
import styles from './CrmPrivacy.module.css'

const mocks=vi.hoisted(()=>({
  company:{selectedCompany:{id:'company-a'}},
  service:{searchContacts:vi.fn(),preview:vi.fn(),exportContact:vi.fn(),anonymize:vi.fn(),getRetentionReview:vi.fn(),saveRetentionReview:vi.fn()},
}))
vi.mock('../contexts/CompanyContext',()=>({useCompany:()=>mocks.company}))
vi.mock('../contexts/FeedbackContext',()=>({useFeedback:()=>({toast:{success:vi.fn(),error:vi.fn()}})}))
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({t:key=>key})}))
vi.mock('../hooks/usePermissions',()=>({usePermissions:()=>({canManagePrivacy:true})}))
vi.mock('../services/crmPrivacyService',()=>({crmPrivacyService:mocks.service}))

let root,host
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  mocks.company.selectedCompany={id:'company-a'}
  mocks.service.getRetentionReview.mockResolvedValue({unresolved_lead_days:90,inactive_contact_days:null,unresolved_leads_for_review:2,inactive_contacts_for_review:0})
  mocks.service.saveRetentionReview.mockImplementation(async(_company,unresolved,inactive)=>({unresolved_lead_days:unresolved,inactive_contact_days:inactive,unresolved_leads_for_review:2,inactive_contacts_for_review:0}))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();vi.unstubAllGlobals()})

it('defines every CSS Module class used by the privacy page',()=>{
  for(const name of ['notice','retention','retentionHeading','retentionNote','retentionFields','retentionCounts','retentionError','retentionSaved','search','success','results','detail','impact','actions','confirm','empty']){
    expect(styles[name],`Missing CrmPrivacy.module.css class: ${name}`).toBeTruthy()
  }
})

it('loads and saves the configured company retention review periods without enabling deletion',async()=>{
  await act(async()=>root.render(<CrmPrivacy/>))
  expect(mocks.service.getRetentionReview).toHaveBeenCalledWith('company-a')
  const [leadDays,contactDays]=host.querySelectorAll('input[type=number]')
  expect(leadDays.value).toBe('90')
  expect(contactDays.value).toBe('')
  expect(host.textContent).toContain('crmPrivacy.retentionManualOnly')
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(leadDays,'120')
    leadDays.dispatchEvent(new Event('input',{bubbles:true}));leadDays.dispatchEvent(new Event('change',{bubbles:true}))
    host.querySelector('section[aria-labelledby="crm-retention-title"] form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))
  })
  expect(mocks.service.saveRetentionReview).toHaveBeenCalledWith('company-a',120,null)
})

it('hides previous-company retention settings while the newly selected company is loading',async()=>{
  let resolveCompanyB
  mocks.service.getRetentionReview.mockImplementation(company=>company==='company-a'
    ? Promise.resolve({unresolved_lead_days:90,inactive_contact_days:45,unresolved_leads_for_review:1,inactive_contacts_for_review:3})
    : new Promise(resolve=>{resolveCompanyB=resolve}))
  await act(async()=>root.render(<CrmPrivacy/>))
  expect(host.querySelector('input[type=number]').value).toBe('90')
  await act(async()=>{
    mocks.company.selectedCompany={id:'company-b'}
    root.render(<CrmPrivacy/>)
  })
  expect(host.querySelector('input[type=number]').value).toBe('')
  expect(host.querySelector('section[aria-labelledby="crm-retention-title"] button[type=submit]').disabled).toBe(true)
  await act(async()=>resolveCompanyB?.({unresolved_lead_days:null,inactive_contact_days:30,unresolved_leads_for_review:0,inactive_contacts_for_review:1}))
  expect(host.querySelectorAll('input[type=number]')[1].value).toBe('30')
})
