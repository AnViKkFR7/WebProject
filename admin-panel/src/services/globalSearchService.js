import { supabase } from '../lib/supabaseClient'

const LIMIT = 6

function pattern(value) {
  const term = String(value || '').trim().slice(0, 80)
  return term.length >= 2 ? `%${term.replace(/[\\%_]/g, '\\$&')}%` : null
}

async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export const globalSearchService = {
  async search(companyId, query, enabledModules) {
    const like = pattern(query)
    if (!companyId || !like) return []

    const requests = []
    if (enabledModules.items !== false) {
      requests.push(run(supabase.from('items').select('id,title,item_type,status').eq('company_id', companyId).ilike('title', like).limit(LIMIT))
        .then(rows => rows.map(row => ({ id: row.id, type: 'item', title: row.title, detail: row.item_type, href: `/items/${encodeURIComponent(row.id)}` }))))
    }
    if (enabledModules.crm !== false) {
      for (const column of ['name', 'email', 'phone']) {
        requests.push(run(supabase.from('crm_contacts').select('id,name,email,phone').eq('company_id', companyId).ilike(column, like).limit(LIMIT))
          .then(rows => rows.map(row => ({ id: row.id, type: 'contact', title: row.name, detail: row.email || row.phone || '', href: `/contacts?contact=${encodeURIComponent(row.id)}` }))))
      }
    }
    if (enabledModules.billing !== false) {
      for (const [table, type, href] of [['invoices', 'invoice', '/invoicing'], ['quotes', 'quote', '/quotes']]) {
        requests.push(run(supabase.from(table).select('id,number,status').eq('company_id', companyId).ilike('number', like).order('created_at', { ascending: false }).limit(LIMIT))
          .then(rows => rows.map(row => ({ id: row.id, type, title: row.number, detail: row.status, href: `${href}/${encodeURIComponent(row.id)}` }))))
        requests.push(run(supabase.from(table).select('id,number,status').eq('company_id', companyId).filter('document->customer->>name', 'ilike', like).order('created_at', { ascending: false }).limit(LIMIT))
          .then(rows => rows.map(row => ({ id: row.id, type, title: row.number, detail: row.status, href: `${href}/${encodeURIComponent(row.id)}` }))))
      }
    }
    const groups = await Promise.all(requests)
    const unique = new Map()
    for (const row of groups.flat()) unique.set(`${row.type}:${row.id}`, row)
    return [...unique.values()].slice(0, 20)
  },
}
