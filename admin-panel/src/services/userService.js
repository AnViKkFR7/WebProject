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

const getFunctionsErrorMessage = (error) => {
  const body = parseFunctionsErrorBody(error?.context?.body)
  if (body) return body.error || body.message || JSON.stringify(body)
  return error?.message || 'Error desconocido'
}

/**
 * Service to handle User Management operations (Admin only).
 */
export const userService = {
  /**
   * Crear usuario con contraseña (vía Edge Function)
   */
  async createUserWithPassword({ email, password, full_name, company_id, role }) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No hay sesión activa')
    }

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email,
        password,
        full_name,
        company_id,
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
      console.error('Error detallado:', error)
      console.error('Functions error context:', error?.context)
      console.error('Functions error body:', parsedBody || errorBodyText)
      const message = parsedBody?.error || parsedBody?.message || errorBodyText || error.message || 'Error al crear usuario'
      throw new Error(message)
    }

    return data
  },

  /**
   * Crear usuario por invitación (vía Edge Function)
   */
  async inviteUser({ email, full_name, company_id, role }) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('No hay sesión activa')
    }

    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email,
        full_name,
        company_id,
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
      console.error('Error detallado:', error)
      console.error('Functions error context:', error?.context)
      console.error('Functions error body:', parsedBody || errorBodyText)
      const message = parsedBody?.error || parsedBody?.message || errorBodyText || error.message || 'Error al invitar usuario'
      throw new Error(message)
    }

    return data
  },

  /**
   * Obtener todos los usuarios del sistema (vía Edge Function)
   */
  async getAllUsers() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No hay sesión activa')

    const { data, error } = await supabase.functions.invoke('listar-usuarios')

    if (error) {
       console.error('Error fetching users:', error)
       throw new Error('Error al obtener lista de usuarios')
    }

    return data.users || []
  },

  /**
   * Verificar si el usuario actual es admin del sistema
   */
  async isCurrentUserAdmin() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return false
      
      // Verificar el claim app_role en app_metadata
      return user.app_metadata?.app_role === 'admin'
    } catch (error) {
      console.error('Error verificando rol de admin:', error)
      return false
    }
  },

  /**
   * Obtener información del usuario actual incluyendo metadata
   */
  async getCurrentUserWithMetadata() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) throw error
    
    return user
  },

  /**
   * Listar todos los usuarios (Admin only - requiere configuración adicional)
   * Nota: Esta función requiere una Edge Function adicional ya que
   * el Admin API de Supabase no está expuesto al frontend
   */
  async listAllUsers() {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('No hay sesión activa')
    }

    // Esta función necesitaría otra Edge Function para listar usuarios
    // Por ahora, podemos obtenerlos desde company_members
    const { data, error } = await supabase
      .from('company_members')
      .select('*')
    
    if (error) throw error
    return data
  },

  /**
   * Obtener miembros de una empresa específica con información de auth.users
   */
  async getCompanyMembersWithAuthInfo(companyId) {
    const { data, error } = await supabase
      .from('company_members')
      .select('*')
      .eq('company_id', companyId)
    
    if (error) throw error
    return data
  }
}
