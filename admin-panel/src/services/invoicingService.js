import { validInvoice } from '../lib/invoicing'
import { supabase } from '../lib/supabaseClient'

async function loadInvoices(companyId, kind = 'invoice') {
  const invoices = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(kind === 'quote' ? 'quotes' : 'invoices').select('*')
      .eq('company_id', companyId).order('created_at', { ascending: false }).order('id')
      .range(offset, offset + 499)
    if (error) throw error
    if (!data.every(row => row.company_id === companyId && validInvoice(row.document))) throw new Error('Invalid billing records; run BILLING_SECURITY_AUDIT.sql')
    invoices.push(...data)
    if (data.length < 500) return invoices
  }
}

export async function loadInvoicing(companyId, kind = 'invoice') {
  const [invoices, settings] = await Promise.all([
    loadInvoices(companyId, kind),
    supabase.from('invoice_settings').select('profile, version').eq('company_id', companyId).maybeSingle(),
  ])
  if (settings.error) throw settings.error
  return { invoices, profile: settings.data?.profile, profileVersion: settings.data?.version ?? 0 }
}
export async function saveProfile(companyId, profile, version) {
  const { data, error } = await supabase.rpc('save_invoice_profile', { p_company: companyId, p_profile: profile, p_version: version })
  if (error) throw error
  return data
}
export async function saveInvoice(companyId, document, status, invoice, kind = 'invoice') {
  const { data, error } = await supabase.rpc(kind === 'quote' ? 'save_quote' : 'save_invoice', {
    p_company: companyId, p_document: document, p_status: status,
    p_id: invoice?.id || null, p_version: invoice?.version || null,
  })
  if (error) throw error
  return data
}

export async function convertQuote(companyId, quote) {
  const { data, error } = await supabase.rpc('convert_quote_to_invoice', {
    p_company: companyId, p_id: quote.id, p_version: quote.version,
  })
  if (error) throw error
  return data
}
