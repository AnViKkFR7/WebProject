import { supabase } from '../lib/supabaseClient'

// Subir archivos al bucket media-planner y devolver array [{name, url}]
export async function uploadPlannerFiles(files, folder = 'tasks') {
  if (!files || !files.length) return []
  const results = []
  for (const file of files) {
    const ext  = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage
      .from('media-planner')
      .upload(path, file, { upsert: false })
    if (error) throw new Error(`Error subiendo ${file.name}: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage
      .from('media-planner')
      .getPublicUrl(path)
    results.push({ name: file.name, url: publicUrl, path })
  }
  return results
}
// Obtener tareas de empresas seleccionadas en un rango de fechas
export async function getPlanningTasks(companyIds, fromDate, toDate) {
  if (!companyIds.length) return []
  let query = supabase
    .from('planning_task')
    .select('*')
    .in('company_id', companyIds)
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
    .in('company_id', companyIds)
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
