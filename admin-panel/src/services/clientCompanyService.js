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

// Obtener las empresas cliente de la empresa tenant actualmente seleccionada
// (todas las que gestiona esa empresa, no solo las creadas por este usuario)
export async function getClientCompaniesByCompany(companyId) {
  const { data, error } = await supabase
    .from('client_company')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Crear una nueva empresa cliente
export async function createClientCompany(company) {
  const { data, error } = await supabase
    .from('client_company')
    .insert([company])
    .select()
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

// Actualizar una empresa cliente
export async function updateClientCompany(companyId, updates) {
  const { data, error } = await supabase
    .from('client_company')
    .update(updates)
    .eq('id', companyId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Cuántas tareas y facturas dependen de una empresa cliente (para avisar antes de borrarla)
export async function getClientCompanyUsage(companyId) {
  const [tasks, bills] = await Promise.all([
    supabase.from('planning_task').select('id', { count: 'exact', head: true }).eq('client_company_id', companyId),
    supabase.from('billing').select('id', { count: 'exact', head: true }).eq('client_company_id', companyId),
  ])
  if (tasks.error) throw tasks.error
  if (bills.error) throw bills.error
  return { tasks: tasks.count || 0, bills: bills.count || 0 }
}
