import { invoiceTotals, validInvoice } from '../../src/lib/invoicing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { database, document, ids, login, profile, save, sqlFile } from './helpers'
let db
const rpcProfile = (value=profile,version=0,company=ids.a) => db.query('select public.save_invoice_profile($1,$2::jsonb,$3) as version',[company,JSON.stringify(value),version])
beforeAll(async () => { db = await database(); await db.exec(await sqlFile('migrations/BILLING_SECURITY_HARDENING.sql')) },30000)
afterAll(async () => { await db?.close() })

describe('tenant isolation — actual PostgreSQL roles and RLS', () => {
  it('keeps profile data and counters separate for each tenant', async () => {
    await login(db,'editor'); await rpcProfile()
    await login(db,'editorB'); await rpcProfile({ ...profile,name:'Issuer B' },0,ids.b)
    const b=await save(db,ids.b)
    await login(db,'editor'); const a=await save(db)
    expect(a.number).toBe('F-000001'); expect(b.number).toBe('F-000001')
    expect((await db.query('select * from public.invoices')).rows.map(r=>r.company_id)).toEqual([ids.a])
    expect((await db.query('select * from public.invoice_settings')).rows.map(r=>r.company_id)).toEqual([ids.a])
  })
  it.each(['viewer','outsider','editorB'])('denies every tenant A write by %s', async user => {
    await login(db,user)
    await expect(save(db)).rejects.toThrow('Forbidden')
    await expect(save(db,ids.a,document(),'draft','quote')).rejects.toThrow('Forbidden')
    await expect(rpcProfile(profile,1)).rejects.toThrow('Forbidden')
    await expect(db.query('select public.convert_quote_to_invoice($1,$2,1)',[ids.a,'30000000-0000-4000-8000-000000000001'])).rejects.toThrow('Forbidden')
  })
  it('allows a viewer to read only their tenant', async () => {
    await login(db,'viewer')
    const rows=(await db.query('select * from public.invoices')).rows
    expect(rows.length).toBeGreaterThan(0); expect(rows.every(r=>r.company_id===ids.a)).toBe(true)
  })
  it('returns no rows at all for an authenticated outsider', async () => {
    await login(db,'outsider')
    for (const table of ['invoices','quotes','invoice_settings']) expect((await db.query(`select * from public.${table}`)).rows).toEqual([])
  })
  it('blocks anonymous table reads and RPC execution', async () => {
    await login(db,null,'anon')
    for (const table of ['invoices','quotes','invoice_settings']) await expect(db.query(`select * from public.${table}`)).rejects.toThrow('permission denied')
    await expect(save(db)).rejects.toThrow('permission denied')
    await expect(rpcProfile()).rejects.toThrow('permission denied')
  })
  it('rejects authenticated roles without a user identity', async () => {
    await login(db,null)
    await expect(save(db)).rejects.toThrow('Forbidden')
  })
  it('blocks direct table writes even by an authorized editor', async () => {
    await login(db,'editor')
    await expect(db.query('update public.invoices set status=\'paid\'')).rejects.toThrow('permission denied')
    await expect(db.query('update public.invoice_settings set next_number=1')).rejects.toThrow('permission denied')
    await expect(db.query('delete from public.quotes')).rejects.toThrow('permission denied')
  })
  it('rejects guessed foreign IDs even if a user is editor in both tenants', async () => {
    await login(db,'dual'); const a=await save(db)
    await expect(save(db,ids.b,document(),'paid','invoice',a)).rejects.toThrow('changed')
    const quote=await save(db,ids.a,document(),'accepted','quote')
    await expect(db.query('select public.convert_quote_to_invoice($1,$2,$3)',[ids.b,quote.id,quote.version])).rejects.toThrow('changed')
    expect((await db.query('select company_id from public.quotes where id=$1',[quote.id])).rows[0].company_id).toBe(ids.a)
  })
  it('retains intentional platform admin permissions', async () => {
    await login(db,'admin')
    expect((await save(db,ids.b)).company_id).toBe(ids.b)
    expect(new Set((await db.query('select company_id from public.invoices')).rows.map(r=>r.company_id)).size).toBe(2)
  })
})

describe('document lifecycle, concurrency and numbering', () => {
  it('does not consume a number if validation fails', async () => {
    await login(db)
    const prev=(await db.query('select next_number from public.invoice_settings where company_id=$1',[ids.a])).rows[0].next_number
    await expect(save(db,ids.a,{ ...document(),lines:[] })).rejects.toThrow()
    const next=await save(db)
    expect(next.number).toBe(`F-${String(prev).padStart(6,'0')}`)
  })
  it('rejects outdated updates and missing versions', async () => {
    const a=await save(db)
    const updated=await save(db,ids.a,document(),'issued','invoice',a)
    expect(updated.version).toBe(2)
    await expect(save(db,ids.a,document(),'paid','invoice',a)).rejects.toThrow('changed')
    await expect(save(db,ids.a,document(),'paid','invoice',{ id:a.id })).rejects.toThrow('version')
  })
  it('prevents editing or reopening cancelled documents', async () => {
    const a=await save(db)
    const cancelled=await save(db,ids.a,document(),'cancelled','invoice',a)
    await expect(save(db,ids.a,document(),'draft','invoice',cancelled)).rejects.toThrow('changed')
    const q=await save(db,ids.a,document(),'draft','quote')
    const closed=await save(db,ids.a,document(),'cancelled','quote',q)
    await expect(save(db,ids.a,document(),'draft','quote',closed)).rejects.toThrow('changed')
  })
  it('keeps invoice and quote status sets distinct', async () => {
    await expect(save(db,ids.a,document(),'accepted')).rejects.toThrow('Invalid status')
    await expect(save(db,ids.a,document(),'paid','quote')).rejects.toThrow('Invalid status')
    await expect(save(db,ids.a,document(),'invoiced','quote')).rejects.toThrow('Invalid status')
  })
  it('converts accepted quotes once, retaining snapshots and author IDs', async () => {
    const doc=document(); doc.dueDate='2026-11-01'
    const q=await save(db,ids.a,doc,'accepted','quote')
    const converted=(await db.query('select * from public.convert_quote_to_invoice($1,$2,$3)',[ids.a,q.id,q.version])).rows[0]
    expect(converted.status).toBe('invoiced')
    const invoice=(await db.query('select * from public.invoices where id=$1',[converted.invoice_id])).rows[0]
    expect(invoice.company_id).toBe(ids.a); expect(invoice.status).toBe('draft')
    expect(invoice.document.issuer).toEqual(doc.issuer); expect(invoice.document.customer).toEqual(doc.customer)
    expect(invoice.document.sourceQuote).toBe(q.number); expect(invoice.document.dueDate).toBe('')
    expect(invoice.created_by).toBe(ids.editor); expect(converted.last_edited_by).toBe(ids.editor)
    await expect(db.query('select public.convert_quote_to_invoice($1,$2,$3)',[ids.a,q.id,converted.version])).rejects.toThrow('changed')
    await expect(save(db,ids.a,doc,'accepted','quote',converted)).rejects.toThrow('changed')
  })
  it('rejects conversion before acceptance', async () => {
    const q=await save(db,ids.a,document(),'sent','quote')
    await expect(db.query('select public.convert_quote_to_invoice($1,$2,$3)',[ids.a,q.id,q.version])).rejects.toThrow('not accepted')
  })

  it('can save issuer details after numbering created an empty settings placeholder', async () => {
    await db.exec('reset role')
    const tenant='10000000-0000-4000-8000-000000000003'
    await db.query('insert into public.companies values ($1)',[tenant])
    await db.query("insert into public.company_members values ($1,$2,'editor')",[tenant,ids.editor])
    await login(db)
    await save(db,tenant)
    expect((await rpcProfile(profile,0,tenant)).rows[0].version).toBe(2)
    await expect(rpcProfile({ ...profile,name:'Stale overwrite' },0,tenant)).rejects.toThrow('changed')
  })
  it('rejects stale profile saves without changing numbering', async () => {
    const before=(await db.query('select * from public.invoice_settings where company_id=$1',[ids.a])).rows[0]
    const res=await rpcProfile({ ...profile,name:'Updated issuer' },before.version)
    expect(res.rows[0].version).toBe(before.version+1)
    await expect(rpcProfile({ ...profile,name:'Stale issuer' },before.version)).rejects.toThrow('changed')
    const after=(await db.query('select * from public.invoice_settings where company_id=$1',[ids.a])).rows[0]
    expect(after.profile.name).toBe('Updated issuer'); expect(after.next_number).toBe(before.next_number)
  })
})

describe('direct API payload validation', () => {
  const cases = [
    ['relative date',d=>{ d.date='today' }],['invalid calendar date',d=>{ d.date='2026-02-31' }],
    ['due date before issue',d=>{ d.dueDate='2020-01-01' }],['object name',d=>{ d.customer.name={} }],
    ['null description',d=>{ d.lines[0].description=null }],['missing quantity',d=>{ delete d.lines[0].quantity }],
    ['NaN price',d=>{ d.lines[0].price='NaN' }],['infinite quantity',d=>{ d.lines[0].quantity='Infinity' }],
    ['negative price',d=>{ d.lines[0].price=-1 }],['zero quantity',d=>{ d.lines[0].quantity=0 }],
    ['discount over 100',d=>{ d.lines[0].discount=101 }],['tax over 100',d=>{ d.lines[0].tax=101 }],
    ['null withholding',d=>{ d.withholding=null }],['object notes',d=>{ d.notes={} }],
    ['remote tracking logo',d=>{ d.issuer.logo='https://example.invalid/x.svg' }],
    ['malformed color',d=>{ d.issuer.color='url(https://example.invalid)' }],
    ['excessive lines',d=>{ d.lines=Array.from({ length:1001 },()=>d.lines[0]) }],
  ]
  it.each(cases)('rejects %s for both document types', async (_name,mutate) => {
    await login(db)
    for (const kind of ['invoice','quote']) { const doc=document(); mutate(doc); await expect(save(db,ids.a,doc,'draft',kind)).rejects.toThrow() }
  })
  it('enforces the composite tenant link even for privileged direct SQL', async () => {
    await login(db,'dual'); const invoice=await save(db,ids.b); const quote=await save(db,ids.a,document(),'accepted','quote')
    await db.exec('reset role')
    await expect(db.query("update public.quotes set invoice_id=$1,status='invoiced' where id=$2",[invoice.id,quote.id])).rejects.toThrow('quotes_invoice_same_tenant')
  })

  it('matches frontend validation and decimal rounding with PostgreSQL numeric', async () => {
    await login(db)
    const samples = [
      { quantity:1.007,price:10,discount:0,tax:21 },
      { quantity:1,price:10.05,discount:10,tax:21 },
      { quantity:.001,price:5,discount:0,tax:21 },
      { quantity:17.123,price:9.99,discount:7.25,tax:10 },
    ]
    for (const line of samples) {
      const doc=document(); doc.lines=[{ description:'Decimal regression',...line }]
      expect(validInvoice(doc)).toBe(true)
      await save(db,ids.a,doc)
      const result=await db.query(`select round($1::numeric*$2::numeric*(1-$3::numeric/100),2)::text as base,
        round(round($1::numeric*$2::numeric*(1-$3::numeric/100),2)*$4::numeric/100,2)::text as tax`,[line.quantity,line.price,line.discount,line.tax])
      expect(invoiceTotals(doc.lines)).toMatchObject({ base:Number(result.rows[0].base),tax:Number(result.rows[0].tax) })
    }
    const poisoned=document(); poisoned.customer.name={}
    expect(validInvoice(poisoned)).toBe(false)
    expect(validInvoice(null)).toBe(false)
  })
  it('can safely apply the hardening migration again', async () => {
    await db.exec('reset role'); await db.exec(await sqlFile('migrations/BILLING_SECURITY_HARDENING.sql'))
  })
})
