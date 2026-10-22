import { supabase } from '../lib/supabaseClient'

const TABLE = 'lead'

export const leadService = {
  /** Todas las solicitudes de la empresa, de la más reciente a la más antigua */
  async getLeads(companyId, limit = 500) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data
  },

  /** Cambia el estado y deja constancia de quién lo tocó */
  async updateLead(id, updates) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, handled_by: user?.id ?? null })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteLead(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  },
}
