import { supabase } from '../lib/supabaseClient'

// Obtener tareas de empresas seleccionadas en un rango de fechas
export async function getPlanningTasks(companyIds, fromDate, toDate) {
  if (!companyIds.length) return []
  let query = supabase
    .from('planning_task')
    .select('*')
    .in('client_company_id', companyIds)
  if (fromDate) query = query.gte('start_datetime', fromDate)
  if (toDate) query = query.lte('end_datetime', toDate)
  const { data, error } = await query.order('start_datetime', { ascending: true })
  if (error) throw error
  return data
}

// Crear nueva tarea
export async function createPlanningTask(task) {
  const { data, error } = await supabase
    .from('planning_task')
    .insert([task])
    .single()
  if (error) throw error
  return data
}

// Obtener facturación de empresas seleccionadas en un rango de fechas
export async function getBilling(companyIds, fromDate, toDate) {
  if (!companyIds.length) return []
  let query = supabase
    .from('billing')
    .select('*')
    .in('client_company_id', companyIds)
  if (fromDate) query = query.gte('billing_date', fromDate)
  if (toDate) query = query.lte('billing_date', toDate)
  const { data, error } = await query.order('billing_date', { ascending: true })
  if (error) throw error
  return data
}

// Crear nueva facturación
export async function createBilling(bill) {
  const { data, error } = await supabase
    .from('billing')
    .insert([bill])
    .single()
  if (error) throw error
  return data
}
