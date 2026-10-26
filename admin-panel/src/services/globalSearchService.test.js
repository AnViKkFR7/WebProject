import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
const rowsByTable = {
  items: [{ id: 'item-1', title: 'Casa', item_type: 'property', status: 'published' }],
  crm_contacts: [{ id: 'contact-1', name: 'Ana', email: 'ana@example.test', phone: null }],
  invoices: [{ id: 'invoice-1', number: 'F-1', status: 'issued' }],
  quotes: [{ id: 'quote-1', number: 'P-1', status: 'sent' }],
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(table => {
      const call = { table, filters: [], limits: [] }
      calls.push(call)
      const builder = {
        select: () => builder,
        eq: (...args) => { call.filters.push(['eq', ...args]); return builder },
        ilike: (...args) => { call.filters.push(['ilike', ...args]); return builder },
        filter: (...args) => { call.filters.push(['filter', ...args]); return builder },
        order: (...args) => { call.filters.push(['order', ...args]); return builder },
        limit: (...args) => { call.limits.push(...args); return builder },
        then: resolve => Promise.resolve({ data: rowsByTable[table], error: null }).then(resolve),
      }
      return builder
    }),
  },
}))

const { globalSearchService } = await import('./globalSearchService')

describe('globalSearchService', () => {
  beforeEach(() => { calls.length = 0 })

  it('searches only enabled modules and scopes every request to the selected company', async () => {
    const results = await globalSearchService.search('company-a', 'Ana', { items: false, crm: true, billing: false })
    expect(calls).toHaveLength(3)
    expect(calls.every(call => call.filters.some(([method, key, value]) => method === 'eq' && key === 'company_id' && value === 'company-a'))).toBe(true)
    expect(calls.every(call => call.table === 'crm_contacts')).toBe(true)
    expect(results).toEqual([{ id: 'contact-1', type: 'contact', title: 'Ana', detail: 'ana@example.test', href: '/contacts?contact=contact-1' }])
  })

  it('returns items, contacts, invoices and quotes with stable destinations', async () => {
    const results = await globalSearchService.search('company-a', 'Ana', { items: true, crm: true, billing: true })
    expect(new Set(results.map(result => result.type))).toEqual(new Set(['item', 'contact', 'invoice', 'quote']))
    expect(results.find(result => result.type === 'item').href).toBe('/items/item-1')
    expect(results.find(result => result.type === 'invoice').href).toBe('/invoicing/invoice-1')
    expect(results.find(result => result.type === 'quote').href).toBe('/quotes/quote-1')
    expect(calls.filter(call => ['invoices', 'quotes'].includes(call.table)).every(call => call.filters.some(([method, key]) => method === 'eq' && key === 'company_id'))).toBe(true)
  })

  it('does not query for terms shorter than two characters or without a company', async () => {
    expect(await globalSearchService.search('company-a', 'x', {})).toEqual([])
    expect(await globalSearchService.search(null, 'Casa', {})).toEqual([])
    expect(calls).toHaveLength(0)
  })
})
