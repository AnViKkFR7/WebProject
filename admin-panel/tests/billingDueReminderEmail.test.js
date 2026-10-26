import {expect,it} from 'vitest'
import {buildBillingDueReminder} from '../../supabase/functions/_shared/billingDueReminder.ts'

const payload={company_id:'tenant-id',invoice_id:'invoice-id',recipient_email:'client@example.test',invoice_number:'F-2026-015',due_date:'2026-11-02',balance:'121.50'}

it('renders only the approved invoice number, due date and balance',()=>{
  const message=buildBillingDueReminder(payload)
  expect(message.subject).toContain(payload.invoice_number)
  expect(message.text).toContain(payload.due_date.slice(0,4))
  expect(message.text).toContain('121,50')
  expect(message.html).not.toContain(payload.recipient_email)
  expect(message.html).not.toContain(payload.company_id)
  expect(message.html).not.toContain(payload.invoice_id)
})

it('escapes invoice number markup and rejects a settled balance or invalid date',()=>{
  expect(buildBillingDueReminder({...payload,invoice_number:'<script>alert(1)</script>'}).html).not.toContain('<script>')
  expect(()=>buildBillingDueReminder({...payload,balance:0})).toThrow('Reminder payload invalid')
  expect(()=>buildBillingDueReminder({...payload,due_date:'2026-02-31'})).toThrow('Reminder due date invalid')
})
