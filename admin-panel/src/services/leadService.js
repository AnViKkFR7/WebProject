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

  /** Solicitudes nuevas sin abrir; solo la cabecera del conteo, sin filas (RLS limita a la empresa) */
  async countNew(companyId) {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'new')
    if (error) throw error
    return count ?? 0
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
