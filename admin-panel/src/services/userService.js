import { supabase } from '../lib/supabaseClient'

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

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    const response = await fetch(
      `${supabaseUrl}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email, 
          password, 
          full_name, 
          company_id, 
          role 
        })
      }
    )
    
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Error al crear usuario')
    }
    
    return result
  },

  /**
   * Crear usuario por invitación (vía Edge Function)
   */
  async inviteUser({ email, full_name, company_id, role }) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('No hay sesión activa')
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    const response = await fetch(
      `${supabaseUrl}/functions/v1/invite-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email, 
          full_name, 
          company_id, 
          role 
        })
      }
    )
    
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Error al invitar usuario')
    }
    
    return result
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
