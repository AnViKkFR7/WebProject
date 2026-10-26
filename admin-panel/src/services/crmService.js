import { supabase } from '../lib/supabaseClient'

export const crmService = {
  async getBoard(companyId) {
    const [stagesResult, contactsResult, reviewResult, membersResult] = await Promise.all([
      supabase.from('crm_pipeline_stages').select('*').eq('company_id', companyId).eq('is_active', true).order('position'),
      supabase.from('crm_contacts').select('*').eq('company_id', companyId).order('updated_at', { ascending: false }).limit(1000),
      supabase.from('lead').select('id,company_id,name,email,phone,message,source_path,source_campaign,source_referrer,source_utm_source,source_utm_medium,source_utm_term,source_utm_content,consent_given,consent_at,consent_text_version,created_at,crm_match_state').eq('company_id', companyId).eq('crm_match_state', 'review_required').order('created_at', { ascending: false }).limit(200),
      supabase.from('company_members').select('user_id,full_name,role,is_active').eq('company_id', companyId).eq('is_active', true).order('full_name'),
    ])
    for (const result of [stagesResult, contactsResult, reviewResult, membersResult]) if (result.error) throw result.error
    return { stages: stagesResult.data || [], contacts: contactsResult.data || [], reviews: reviewResult.data || [], members: membersResult.data || [] }
  },

  async updateContact(companyId, contactId, updates) {
    const { data, error } = await supabase.from('crm_contacts').update(updates)
      .eq('company_id', companyId).eq('id', contactId).select().single()
    if (error) throw error
    return data
  },

  async createStage(companyId, stage) {
    const { data, error } = await supabase.from('crm_pipeline_stages').insert({ company_id: companyId, ...stage }).select().single()
    if (error) throw error
    return data
  },

  async updateStage(companyId, stageId, updates) {
    const { data, error } = await supabase.from('crm_pipeline_stages').update(updates)
      .eq('company_id', companyId).eq('id', stageId).select().single()
    if (error) throw error
    return data
  },

  async getContactTimeline(companyId, contactId) {
    const { data, error } = await supabase.from('crm_activities').select('*')
      .eq('company_id', companyId).eq('contact_id', contactId).order('occurred_at', { ascending: false }).limit(200)
    if (error) throw error
    return data || []
  },

  async getContactBilling(companyId, contactId) {
    const [linked, available] = await Promise.all([
      supabase.rpc('list_crm_billing_documents', { p_company: companyId, p_contact: contactId }),
      supabase.rpc('list_crm_linkable_billing_documents', { p_company: companyId, p_contact: contactId }),
    ])
    if (linked.error) throw linked.error
    if (available.error) throw available.error
    return { linked: linked.data || [], available: available.data || [] }
  },

  async linkBillingDocument(companyId, contactId, kind, documentId) {
    const { data, error } = await supabase.rpc('link_crm_billing_document', {
      p_company: companyId, p_contact: contactId, p_kind: kind, p_document: documentId,
    })
    if (error) throw error
    return data
  },

  async unlinkBillingDocument(companyId, linkId) {
    const { error } = await supabase.rpc('unlink_crm_billing_document', { p_company: companyId, p_link: linkId })
    if (error) throw error
  },

  async addActivity(companyId, contactId, activity) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('crm_activities').insert({
      company_id: companyId, contact_id: contactId, created_by: user?.id || null, ...activity,
    }).select().single()
    if (error) throw error
    return data
  },

  async resolveLead({ companyId, leadId, contactId = null, createContact = false }) {
    const { data, error } = await supabase.rpc('resolve_crm_lead_contact', {
      p_company: companyId, p_lead: leadId, p_contact: contactId, p_create_contact: createContact,
    })
    if (error) throw error
    return data
  },
}
