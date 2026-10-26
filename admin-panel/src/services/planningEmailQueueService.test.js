import {beforeEach,expect,it,vi} from 'vitest'
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../lib/supabaseClient',()=>({supabase:{rpc}}))
import {listPlanningEmailFailures,retryPlanningEmail} from './planningService'

const company='10000000-0000-4000-8000-000000000001'
const id='40000000-0000-4000-8000-000000000001'
beforeEach(()=>rpc.mockReset())

it('loads company failures through the permission-checked RPC and rejects cross-shaped responses',async()=>{
  rpc.mockResolvedValue({data:[{id,task_id:'40000000-0000-4000-8000-000000000002',task_title:'Demo',last_error_code:'provider_unavailable',attempt_count:3,updated_at:'2026-10-26T10:00:00Z'}],error:null})
  expect(await listPlanningEmailFailures(company)).toHaveLength(1)
  expect(rpc).toHaveBeenCalledWith('list_planning_email_failures',{p_company:company})
  rpc.mockResolvedValue({data:[{id:'foreign',task_id:id}],error:null})
  await expect(listPlanningEmailFailures(company)).rejects.toThrow('Invalid reminder failures')
  await expect(listPlanningEmailFailures('invalid')).rejects.toThrow('Invalid company')
})

it('retries only a queue ID in the selected company and preserves RPC denials',async()=>{
  rpc.mockResolvedValue({data:true,error:null})
  expect(await retryPlanningEmail(company,id)).toBe(true)
  expect(rpc).toHaveBeenCalledWith('retry_planning_email',{p_company:company,p_queue:id})
  rpc.mockResolvedValue({data:false,error:null})
  expect(await retryPlanningEmail(company,id)).toBe(false)
  rpc.mockResolvedValue({data:null,error:new Error('Forbidden')})
  await expect(retryPlanningEmail(company,id)).rejects.toThrow('Forbidden')
  await expect(retryPlanningEmail(company,'invalid')).rejects.toThrow('Invalid reminder')
})
