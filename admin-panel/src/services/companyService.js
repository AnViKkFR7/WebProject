import { supabase } from '../lib/supabaseClient'

const parseFunctionsErrorBody = (body) => {
  if (!body) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return { message: body }
    }
  }
  return body
}

const getFunctionsErrorMessage = (error, fallbackMessage) => {
  const body = parseFunctionsErrorBody(error?.context?.body)
  if (body) return body.error || body.message || JSON.stringify(body)
  return error?.message || fallbackMessage
}

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
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No hay sesión activa')
    }

    const { data, error } = await supabase.functions.invoke('crear-empresa', {
      body: companyData
    })

    if (error) {
      let errorBodyText = null
      if (error?.context?.text) {
        try {
          errorBodyText = await error.context.text()
        } catch {
          errorBodyText = null
        }
      }
      const parsedBody = parseFunctionsErrorBody(errorBodyText)
      const message = parsedBody?.error || parsedBody?.message || errorBodyText || getFunctionsErrorMessage(error, 'Error al crear empresa')
      throw new Error(message)
    }

    return data?.company || data
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

  async getMyCompanies() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado')
    return this.getUserCompanies(user.id)
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
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No hay sesión activa')
    }

    const { data, error } = await supabase.functions.invoke('crear-nuevo-trabajador', {
      body: {
        company_id: companyId,
        user_id: userId,
        role
      }
    })

    if (error) {
      let errorBodyText = null
      if (error?.context?.text) {
        try {
          errorBodyText = await error.context.text()
        } catch {
          errorBodyText = null
        }
      }
      const parsedBody = parseFunctionsErrorBody(errorBodyText)
      const message = parsedBody?.error || parsedBody?.message || errorBodyText || getFunctionsErrorMessage(error, 'Error al crear miembro')
      throw new Error(message)
    }

    return data?.member || data
  },

  async updateMemberRole(companyId, userId, newRole) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No hay sesión activa')
    }

    const { data, error } = await supabase.functions.invoke('cambiar-rol-usuario', {
      body: {
        company_id: companyId,
        user_id: userId,
        role: newRole
      }
    })

    if (error) {
      let errorBodyText = null
      if (error?.context?.text) {
        try {
          errorBodyText = await error.context.text()
        } catch {
          errorBodyText = null
        }
      }
      const parsedBody = parseFunctionsErrorBody(errorBodyText)
      const message = parsedBody?.error || parsedBody?.message || errorBodyText || getFunctionsErrorMessage(error, 'Error al actualizar rol')
      throw new Error(message)
    }

    return data
  },

  async removeMember(companyId, userId) {
    const { error } = await supabase
      .from('company_members')
      .delete()
      .match({ company_id: companyId, user_id: userId })

    if (error) throw error
  },

  // --- Current User Member Profile ---

  async getCurrentUserMemberProfile(companyId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado')

    const { data, error } = await supabase
      .from('company_members')
      .select('*')
      .match({ company_id: companyId, user_id: user.id })
      .single()

    if (error) throw error
    return data
  },

  async updateCurrentUserMemberProfile(companyId, updates) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado')

    const { data, error } = await supabase
      .from('company_members')
      .update(updates)
      .match({ company_id: companyId, user_id: user.id })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
