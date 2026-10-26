import { supabase } from '../lib/supabaseClient'

// Obtener todas las empresas cliente del usuario actual
export async function getClientCompanies(userId) {
  const { data, error } = await supabase
    .from('client_company')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
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
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Crear una nueva empresa cliente
export async function createClientCompany(company) {
  const { data, error } = await supabase.rpc('save_client_company', {
    p_company:company.company_id,p_id:null,p_name:company.name,p_tax_id:company.tax_id || '',p_billing_address:company.billing_address || '',
    p_email:company.email || '',p_phone:company.phone || '',p_responsible:company.responsible || '',p_color:company.color || '#1976d2',
  })
  if (error) throw error
  return data
}

// Eliminar una empresa cliente
export async function deleteClientCompany(companyId,tenantId) {
  const { error } = await supabase.rpc('archive_client_company',{p_company:tenantId,p_id:companyId})
  if (error) throw error
  return true
}

// Obtener todas las empresas (para admin) o solo las del usuario
export async function getClientCompaniesFlexible(userId, isAdmin) {
  let query = supabase.from('client_company').select('*').is('archived_at', null)
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
  const { data, error } = await supabase.rpc('save_client_company', {
    p_company:updates.company_id,p_id:companyId,p_name:updates.name,p_tax_id:updates.tax_id || '',p_billing_address:updates.billing_address || '',
    p_email:updates.email || '',p_phone:updates.phone || '',p_responsible:updates.responsible || '',p_color:updates.color || '#1976d2',
  })
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
