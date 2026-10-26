import { supabase } from '../lib/supabaseClient'

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

export const crmPrivacyService = {
  searchContacts(companyId, query) {
    return rpc('list_crm_privacy_contacts', { p_company: companyId, p_query: query })
  },
  preview(companyId, contactId) {
    return rpc('preview_crm_contact_anonymization', { p_company: companyId, p_contact: contactId })
  },
  exportContact(companyId, contactId) {
    return rpc('export_crm_contact', { p_company: companyId, p_contact: contactId })
  },
  anonymize(companyId, contactId, requestId) {
    return rpc('anonymize_crm_contact', { p_company: companyId, p_contact: contactId, p_request: requestId })
  },
  getRetentionReview(companyId) {
    return rpc('get_crm_retention_review', { p_company: companyId })
  },
  saveRetentionReview(companyId, unresolvedLeadDays, inactiveContactDays) {
    return rpc('save_crm_retention_review_settings', {
      p_company: companyId,
      p_unresolved_lead_days: unresolvedLeadDays,
      p_inactive_contact_days: inactiveContactDays,
    })
  },
}
