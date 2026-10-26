import {beforeEach,it,expect,vi} from 'vitest'
import {document} from '../../tests/database/helpers'
const mock=vi.hoisted(()=>({rpc:vi.fn(),result:null,signal:vi.fn()}))
vi.mock('../lib/supabaseClient',()=>({supabase:{rpc:mock.rpc}}))
import {loadDocumentDraft,saveDocumentDraft,deleteDocumentDraft} from './documentDraftService'
const scope={companyId:'a',userId:'u',kind:'invoice',key:'new'}
const row={id:'draft',company_id:'a',owner_id:'u',kind:'invoice',document_key:'new',version:1,document:document()}
beforeEach(()=>{mock.rpc.mockReset().mockReturnValue({abortSignal:mock.signal});mock.signal.mockReset().mockImplementation(async()=>mock.result);mock.result={data:row,error:null}})
it('passes the complete scope, previous request and a deadline when loading',async()=>{
  expect(await loadDocumentDraft(scope,'previous')).toEqual(row)
  expect(mock.rpc).toHaveBeenCalledWith('get_billing_draft',{p_company:'a',p_kind:'invoice',p_key:'new',p_previous:'previous'})
  expect(mock.signal).toHaveBeenCalledWith(expect.any(AbortSignal))
})
it('rejects another user, company, kind or document in recovery responses',async()=>{
  for(const change of [{owner_id:'other'},{company_id:'other'},{kind:'quote'},{document_key:'other'},{document:{bad:true}}]) {
    mock.result={data:{...row,...change},error:null}
    await expect(loadDocumentDraft(scope)).rejects.toThrow('Invalid draft response')
  }
})
it('writes a scoped incomplete copy with CAS and idempotency, and deletes only the expected revision',async()=>{
  await saveDocumentDraft(scope,document(),null,0,'write')
  expect(mock.rpc).toHaveBeenLastCalledWith('save_billing_draft',expect.objectContaining({p_company:'a',p_kind:'invoice',p_key:'new',p_version:0,p_write:'write',p_base_version:null}))
  await deleteDocumentDraft(scope,1)
  expect(mock.rpc).toHaveBeenLastCalledWith('delete_billing_draft',{p_company:'a',p_kind:'invoice',p_key:'new',p_version:1})
  mock.result={error:{code:'40001'}}
  await expect(saveDocumentDraft(scope,document(),null,0,'write')).rejects.toMatchObject({code:'40001'})
})
it('validates the company of an already completed request',async()=>{
  mock.result={data:{completed_record:{id:'final',company_id:'b',document:document()}},error:null}
  await expect(loadDocumentDraft(scope)).rejects.toThrow('Invalid completed draft response')
})
