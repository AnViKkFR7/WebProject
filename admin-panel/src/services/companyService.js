import { supabase } from '../lib/supabaseClient'

/**
 * Service to handle Company and Company Members operations.
 */
export const companyService = {
  // --- Companies ---

  async getAllCompanies() {
    // Admin mainly, or use generic RLS
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data
  },

  async getCompanyById(id) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async createCompany(companyData) {
    const { data, error } = await supabase
      .from('companies')
      .insert(companyData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateCompany(id, updates) {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteCompany(id) {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // --- Company Members ---

  async getCompanyMembers(companyId) {
    // Joins with user_profiles/auth info if accessible, for now just members
    // Assuming we want profile info:
    const { data, error } = await supabase
      .from('company_members')
      .select(`
        *,
        user_profiles (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('company_id', companyId)
    
    if (error) throw error
    return data
  },

  async getUserCompanies(userId) {
    // Get companies a user belongs to
    const { data, error } = await supabase
      .from('company_members')
      .select(`
        role,
        companies (*)
      `)
      .eq('user_id', userId)
    
    if (error) throw error
    return data
  },

  async addMember(companyId, userId, role = 'viewer') {
    const { data, error } = await supabase
      .from('company_members')
      .insert({
        company_id: companyId,
        user_id: userId,
        role
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateMemberRole(companyId, userId, newRole) {
    const { data, error } = await supabase
      .from('company_members')
      .update({ role: newRole })
      .match({ company_id: companyId, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async removeMember(companyId, userId) {
    const { error } = await supabase
      .from('company_members')
      .delete()
      .match({ company_id: companyId, user_id: userId })

    if (error) throw error
  }
}
