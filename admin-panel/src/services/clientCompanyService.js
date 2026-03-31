import { supabase } from '../lib/supabaseClient'

// Obtener todas las empresas cliente del usuario actual
export async function getClientCompanies(userId) {
  const { data, error } = await supabase
    .from('client_company')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Crear una nueva empresa cliente
export async function createClientCompany(company) {
  const { data, error } = await supabase
    .from('client_company')
    .insert([company])
    .single()
  if (error) throw error
  return data
}

// Eliminar una empresa cliente
export async function deleteClientCompany(companyId) {
  const { error } = await supabase
    .from('client_company')
    .delete()
    .eq('id', companyId)
  if (error) throw error
  return true
}

// Obtener todas las empresas (para admin) o solo las del usuario
export async function getClientCompaniesFlexible(userId, isAdmin) {
  let query = supabase.from('client_company').select('*')
  if (!isAdmin) {
    query = query.eq('user_id', userId)
  }
  // Si es admin, no filtra por user_id (devuelve todas)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}
