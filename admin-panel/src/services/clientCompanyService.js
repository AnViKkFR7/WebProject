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

// Datos de la ficha tal como los valida save_directory_party (cliente/colaborador, persona/empresa)
export const partyPayload = party => ({
  name:party.name || '',tax_id:party.tax_id || '',billing_address:party.billing_address || '',email:party.email || '',
  phone:party.phone || '',responsible:party.responsible || '',color:party.color || '#1976d2',
  legal_form:party.legal_form === 'individual' ? 'individual' : 'company',
  is_client:party.is_client !== false,is_collaborator:party.is_collaborator === true,
  collaborator_role:party.collaborator_role || '',notes:party.notes || '',
})

async function saveParty(tenantId,id,party) {
  const { data, error } = await supabase.rpc('save_directory_party',{p_company:tenantId,p_id:id,p_party:partyPayload(party)})
  if (error) throw error
  if (!data || data.company_id !== tenantId) throw new Error('Invalid directory response')
  return data
}

// Crear una ficha (cliente, colaborador o ambos)
export async function createClientCompany(company) {
  return saveParty(company.company_id,null,company)
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

// Actualizar una ficha
export async function updateClientCompany(companyId, updates) {
  return saveParty(updates.company_id,companyId,updates)
}

// Una ficha concreta de la empresa seleccionada (RLS limita a sus miembros)
export async function getDirectoryParty(tenantId,id) {
  const { data, error } = await supabase.from('client_company').select('*').eq('company_id',tenantId).eq('id',id).is('archived_at',null).maybeSingle()
  if (error) throw error
  return data
}

// Resumen de actividad de la ficha: facturas, presupuestos, agenda y movimientos (calculado en servidor)
export async function getDirectoryPartySummary(tenantId,id) {
  const { data, error } = await supabase.rpc('get_directory_party_summary',{p_company:tenantId,p_id:id})
  if (error) throw error
  if (!data || data.party_id !== id) throw new Error('Invalid directory summary')
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
