import { beforeEach, describe, expect, it, vi } from 'vitest'
import { document } from '../../tests/database/helpers'
const { from,queries } = vi.hoisted(() => ({ from:vi.fn(),queries:[] }))
vi.mock('../lib/supabaseClient', () => ({ supabase:{ from } }))
import { loadInvoicing } from './invoicingService'
beforeEach(() => { from.mockReset(); queries.length=0 })
function mockTables(rows) {
  from.mockImplementation(table => {
    const query={ table,filter:null,range:null }
    queries.push(query)
    const builder={
      select:vi.fn(()=>builder),eq:vi.fn((column,value)=>{ query.filter=[column,value];return builder }),
      order:vi.fn(()=>builder),
      range:vi.fn(async (a,b)=>{ query.range=[a,b];return { data:rows.slice(a,b+1),error:null } }),
      maybeSingle:vi.fn(async()=>({ data:{ profile:{ name:'Issuer' },version:4 },error:null })),
    }
    return builder
  })
}
describe('document loading remains scoped to company and document type', () => {
  it('applies the tenant filter to every page and the saved profile', async () => {
    mockTables(Array.from({ length:501 },(_,i)=>({ id:String(i),company_id:'tenant-a',document:document() })))
    const result=await loadInvoicing('tenant-a','quote')
    expect(result.invoices).toHaveLength(501)
    expect(result.profileVersion).toBe(4)
    expect(queries.every(q=>q.filter[0]==='company_id' && q.filter[1]==='tenant-a')).toBe(true)
    expect(queries.filter(q=>q.table==='quotes').map(q=>q.range)).toEqual([[0,499],[500,999]])
    expect(queries.some(q=>q.table==='invoices')).toBe(false)
  })
  it('rejects a mismatched company in a server response', async () => {
    mockTables([{ id:'foreign',company_id:'tenant-b',document:document() }])
    await expect(loadInvoicing('tenant-a')).rejects.toThrow('Invalid billing records')
  })
  it('fails safely on malformed historical records instead of rendering objects as text', async () => {
    mockTables([{ id:'bad',company_id:'tenant-a',document:{ customer:{ name:{} } } }])
    await expect(loadInvoicing('tenant-a')).rejects.toThrow('Invalid billing records')
  })
})
