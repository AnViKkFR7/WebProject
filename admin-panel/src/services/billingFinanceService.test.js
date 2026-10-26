import {beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));vi.mock('../lib/supabaseClient',()=>({supabase:{rpc:mocks.rpc,from:mocks.from}}))
import {loadBillingFinanceDetail,loadInvoiceFinancials,registerInvoicePayment,restoreBillingDraftVersion,reverseInvoicePayment,loadBillingDueReminderSettings,saveBillingDueReminderSettings,loadInvoiceDueReminderPreference,setInvoiceDueReminders,loadBillingDueReminderFailures,retryBillingDueReminder} from './billingFinanceService'
beforeEach(()=>{mocks.rpc.mockReset();mocks.from.mockReset()})
it('normalizes financial summaries and uses scoped RPC parameters',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:[{invoice_id:'i',total:'121',paid:'50',balance:'71',payment_state:'partial'}],error:null})
  expect(await loadInvoiceFinancials('a')).toEqual([expect.objectContaining({total:121,paid:50,balance:71})])
  mocks.rpc.mockResolvedValue({data:{id:'entry'},error:null});const invoice={id:'i',version:3}
  await registerInvoicePayment('a',invoice,{amount:'20',date:'2026-10-24',method:'Transferencia',reference:'R',requestId:'request'})
  await reverseInvoicePayment('a',{id:'entry'},'Devuelto','reverse')
  await restoreBillingDraftVersion('a','invoice',invoice,{id:9})
  expect(mocks.rpc).toHaveBeenNthCalledWith(2,'register_invoice_payment',expect.objectContaining({p_company:'a',p_invoice:'i',p_version:3,p_request:'request'}))
  expect(mocks.rpc).toHaveBeenNthCalledWith(3,'reverse_invoice_payment',{p_company:'a',p_payment:'entry',p_request:'reverse',p_reason:'Devuelto'})
  expect(mocks.rpc).toHaveBeenNthCalledWith(4,'restore_billing_draft_version',{p_company:'a',p_kind:'invoice',p_record:'i',p_event:9,p_version:3})
})
it('loads scoped payment and history rows and rejects crossed data',async()=>{
  let crossed=false;mocks.from.mockImplementation(table=>{const response=()=>({data:table==='billing_payment_entries'?[{id:'p',company_id:crossed?'b':'a',invoice_id:'i'}]:[{id:1,company_id:'a',record_id:'i'}],error:null});const builder={select:()=>builder,eq:()=>builder,order:()=>builder,limit:async()=>response(),range:async()=>response()};return builder})
  expect(await loadBillingFinanceDetail('a','invoice','i')).toEqual({payments:[expect.objectContaining({id:'p'})],history:[expect.objectContaining({id:1})],historyHasMore:false})
  expect(await loadBillingFinanceDetail('a','quote','i')).toEqual({payments:[],history:[expect.objectContaining({id:1})],historyHasMore:false})
  crossed=true;await expect(loadBillingFinanceDetail('a','invoice','i')).rejects.toThrow('Invalid billing finance scope')
})
it('loads default reminder settings and stores validated configuration via RPC',async()=>{
  const builder={select:vi.fn(()=>builder),eq:vi.fn(()=>builder),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})};mocks.from.mockReturnValue(builder)
  expect(await loadBillingDueReminderSettings('a')).toMatchObject({company_id:'a',enabled:false,offsets_days:[7,1,0,-7],timezone:'Europe/Madrid'})
  mocks.rpc.mockResolvedValueOnce({data:{company_id:'a',enabled:true,offsets_days:[7,1],local_send_time:'09:30:00'},error:null})
  await saveBillingDueReminderSettings('a',{enabled:true,offsetsDays:[7,1],sendTime:'09:30'})
  expect(mocks.rpc).toHaveBeenCalledWith('save_billing_due_reminder_settings',{p_company:'a',p_enabled:true,p_offsets:[7,1],p_send_time:'09:30'})
})
it('loads invoice opt-out and writes the preference through a scoped RPC',async()=>{
  const builder={select:vi.fn(()=>builder),eq:vi.fn(()=>builder),maybeSingle:vi.fn().mockResolvedValue({data:{company_id:'a',invoice_id:'i',suppressed:true},error:null})};mocks.from.mockReturnValue(builder)
  expect(await loadInvoiceDueReminderPreference('a','i')).toEqual({company_id:'a',invoice_id:'i',suppressed:true})
  mocks.rpc.mockResolvedValueOnce({data:{company_id:'a',invoice_id:'i',suppressed:false},error:null})
  await setInvoiceDueReminders('a','i',false)
  expect(mocks.rpc).toHaveBeenCalledWith('set_invoice_due_reminders',{p_company:'a',p_invoice:'i',p_suppressed:false})
})
it('scopes failed reminders to the selected company and retries by queue id',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:[{company_id:'a',id:'q',invoice_id:'i'}],error:null})
  expect(await loadBillingDueReminderFailures('a')).toEqual([{company_id:'a',id:'q',invoice_id:'i'}])
  mocks.rpc.mockResolvedValueOnce({data:true,error:null})
  expect(await retryBillingDueReminder('a','q')).toBe(true)
  mocks.rpc.mockResolvedValueOnce({data:[{company_id:'b',id:'q'}],error:null})
  await expect(loadBillingDueReminderFailures('a')).rejects.toThrow('Invalid billing reminder scope')
})
