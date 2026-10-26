// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({list:vi.fn(),retry:vi.fn()}))
vi.mock('../../services/planningService',()=>({listPlanningEmailFailures:(...args)=>mocks.list(...args),retryPlanningEmail:(...args)=>mocks.retry(...args)}))
import PlanningEmailFailures from './PlanningEmailFailures'

let root,container
const company='10000000-0000-4000-8000-000000000001'
const failure={id:'40000000-0000-4000-8000-000000000001',task_id:'40000000-0000-4000-8000-000000000002',task_title:'Demo planning',last_error_code:'provider_unavailable',attempt_count:3,updated_at:'2026-10-26T10:00:00Z'}
const t=(key,values)=>values?`${key}:${values.count}`:key
async function render(canEdit=true){await act(async()=>root.render(<PlanningEmailFailures companyId={company} canEdit={canEdit} t={t}/>))}

beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
  mocks.list.mockReset().mockResolvedValue([failure]);mocks.retry.mockReset().mockResolvedValue(true)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()})

it('shows company failures to viewers without a retry action',async()=>{
  await render(false)
  expect(container.textContent).toContain('Demo planning')
  expect(container.querySelector('button')).toBeTruthy() // Refresh
  expect([...container.querySelectorAll('button')].some(button=>button.textContent==='emailFailureRetry')).toBe(false)
})

it('lets an editor retry one dead letter and removes it only after server acceptance',async()=>{
  await render(true)
  const button=[...container.querySelectorAll('button')].find(item=>item.textContent==='emailFailureRetry')
  await act(async()=>button.click())
  expect(mocks.retry).toHaveBeenCalledWith(company,failure.id)
  expect(container.textContent).toContain('emailRetryQueued')
  expect(container.textContent).toContain('emailFailuresEmpty')
})

it('does not offer retry when delivery may already have happened',async()=>{
  mocks.list.mockResolvedValue([{...failure,last_error_code:'sent_marker_failed'}])
  await render(true)
  expect(container.textContent).toContain('emailDeliveryUncertain')
  expect([...container.querySelectorAll('button')].some(button=>button.textContent==='emailFailureRetry')).toBe(false)
})
