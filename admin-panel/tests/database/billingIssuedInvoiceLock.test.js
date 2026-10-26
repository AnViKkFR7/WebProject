import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'

let db
beforeAll(async()=>{
  db=await database()
  for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DIRECTORY_CATALOG.sql','BILLING_CHAPTER_TEMPLATES.sql','BILLING_PAYMENTS_HISTORY.sql','BILLING_ISSUED_INVOICE_LOCK.sql'])
    await db.exec(await sqlFile(`migrations/${file}`))
  await login(db)
},30000)
afterAll(async()=>db?.close())

it('rejects manual paid status and permits only editable drafts to be cancelled',async()=>{
  await expect(save(db,ids.a,document(),'paid')).rejects.toThrow('Invalid initial invoice status')
  const draft=await save(db)
  const cancelled=await save(db,ids.a,document(),'cancelled','invoice',draft)
  expect(cancelled.status).toBe('cancelled')
})

it('freezes issued invoice content and status changes while payment RPCs remain available',async()=>{
  const issued=await save(db,ids.a,document(),'issued')
  const changed=document();changed.notes='No debe modificarse'
  await expect(save(db,ids.a,changed,'issued','invoice',issued)).rejects.toThrow('immutable')
  await expect(save(db,ids.a,document(),'cancelled','invoice',issued)).rejects.toThrow('immutable')
  const payment=(await db.query('select public.register_invoice_payment($1,$2,$3,$4,$5,current_date,$6,$7) result',[ids.a,issued.id,issued.version,'40000000-0000-4000-8000-000000000011',121,'Transferencia','F-1'])).rows[0].result
  expect(payment.invoice_status).toBe('paid')
  const paid=(await db.query('select * from public.invoices where id=$1',[issued.id])).rows[0]
  await expect(save(db,ids.a,document(),'paid','invoice',paid)).rejects.toThrow('immutable')
  const summary=(await db.query('select * from public.get_invoice_financials($1)',[ids.a])).rows
  expect(summary.find(row=>row.invoice_id===issued.id).payment_state).toBe('paid')
})
