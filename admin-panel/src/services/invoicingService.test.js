import { beforeEach, describe, expect, it, vi } from 'vitest'
const { rpc } = vi.hoisted(() => ({ rpc:vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase:{ rpc } }))
import { saveInvoice, convertQuote, saveProfile } from './invoicingService'
beforeEach(() => rpc.mockReset())
describe('invoices and quotes RPCs', () => {
  it('commits a prepared recovery copy atomically only on explicit document save',async()=>{
    rpc.mockReturnValue({abortSignal:vi.fn().mockResolvedValue({data:{id:'committed'},error:null})})
    await saveInvoice('tenant',{notes:'final'},'issued',null,'invoice',{id:'draft',version:4,key:'new'})
    expect(rpc).toHaveBeenCalledWith('commit_billing_draft',{p_company:'tenant',p_kind:'invoice',p_key:'new',p_request:'draft',p_version:4,p_document:{notes:'final'},p_status:'issued',p_invoice_version:null})
  })
  it('saves invoices through the invoice RPC by default', async () => {
    rpc.mockResolvedValue({ data:{ id:'invoice' },error:null })
    await saveInvoice('tenant',{},'draft',null)
    expect(rpc).toHaveBeenCalledWith('save_invoice',expect.objectContaining({ p_company:'tenant',p_id:null,p_version:null }))
  })
  it('saves quotes with tenant and optimistic version', async () => {
    rpc.mockResolvedValue({ data:{ id:'quote' },error:null })
    await saveInvoice('tenant',{},'accepted',{ id:'quote',version:2 },'quote')
    expect(rpc).toHaveBeenCalledWith('save_quote',expect.objectContaining({ p_company:'tenant',p_id:'quote',p_version:2,p_status:'accepted' }))
  })
  it('converts a saved quote with version checking', async () => {
    rpc.mockResolvedValue({ data:{ id:'quote',status:'invoiced' },error:null })
    expect(await convertQuote('tenant',{ id:'quote',version:4 })).toMatchObject({ status:'invoiced' })
    expect(rpc).toHaveBeenCalledWith('convert_quote_to_invoice',{ p_company:'tenant',p_id:'quote',p_version:4 })
  })
  it('does not report success if issuer details could not be saved', async () => {
    rpc.mockResolvedValue({ error:new Error('Forbidden') })
    await expect(saveProfile('tenant',{},1)).rejects.toThrow('Forbidden')
  })
  it('passes the profile version and returns the new one', async () => {
    rpc.mockResolvedValue({ data:3,error:null })
    expect(await saveProfile('tenant',{ name:'Company' },2)).toBe(3)
    expect(rpc).toHaveBeenCalledWith('save_invoice_profile',{ p_company:'tenant',p_profile:{ name:'Company' },p_version:2 })
  })

})
