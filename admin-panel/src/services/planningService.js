import { supabase } from '../lib/supabaseClient'

// Subir archivos al bucket media-planner y devolver array [{name, url}]
export async function uploadPlannerFiles(files, folder = 'tasks', companyId) {
  if (!files || !files.length) return []
  if (!/^[0-9a-f-]{36}$/i.test(companyId || '') || !['tasks','billing'].includes(folder)) throw new Error('Invalid tenant or attachment folder')
  const results = []
  for (const file of files) {
    const ext  = file.name.split('.').pop()
    const path = `${companyId}/${folder}/${crypto.randomUUID()}.${ext.replace(/[^a-zA-Z0-9]/g, '') || 'bin'}`
    const { error } = await supabase.storage
      .from('media-planner')
      .upload(path, file, { upsert: false })
    if (error) throw new Error(`Error subiendo ${file.name}: ${error.message}`)
    // El bucket es privado: se guarda solo la ruta y al abrir el archivo se
    // pide una URL firmada. Antes se guardaba una URL pública que no abría.
    results.push({ name: file.name, path })
  }
  return results
}
// Obtener tareas de la empresa tenant actual, filtradas por las empresas
// cliente seleccionadas en un rango de fechas. Las tareas generales sin
// empresa asociada (client_company_id null) se incluyen siempre, sea cual
// sea la selección — un "IN" normal nunca las traería, porque en SQL NULL
// nunca coincide con IN (...).
export async function getPlanningTasks(companyId, clientCompanyIds, fromDate, toDate) {
  if (!companyId) return []
  let query = supabase
    .from('planning_task')
    .select('*')
    .eq('company_id', companyId)

  if (clientCompanyIds && clientCompanyIds.length > 0) {
    query = query.or(`client_company_id.in.(${clientCompanyIds.join(',')}),client_company_id.is.null`)
  } else {
    query = query.is('client_company_id', null)
  }

  // Las recurrentes se traen siempre: su fila original puede ser muy anterior
  // al rango y aun así tener ocurrencias dentro (se expanden en lib/recurrence).
  if (fromDate && toDate) {
    query = query.or(`recurrence_type.neq.none,and(start_datetime.gte.${fromDate},start_datetime.lte.${toDate})`)
  } else if (fromDate) {
    query = query.gte('start_datetime', fromDate)
  } else if (toDate) {
    query = query.lte('start_datetime', toDate)
  }
  const { data, error } = await query.order('start_datetime', { ascending: true })
  if (error) throw error
  return data
}

// Crear nueva tarea
export async function createPlanningTask(task) {
  const { data, error } = await supabase
    .from('planning_task')
    .insert([task])
    .select()
    .single()
  if (error) throw error
  return data
}

// Obtener facturación de la empresa tenant actual, filtrada por las
// empresas cliente seleccionadas en un rango de fechas
export async function getBilling(companyId, clientCompanyIds, fromDate, toDate) {
  if (!companyId || !clientCompanyIds?.length) return []
  let query = supabase
    .from('billing')
    .select('*')
    .eq('company_id', companyId)
    .in('client_company_id', clientCompanyIds)
  if (fromDate && toDate) {
    query = query.or(`recurrence_type.neq.none,and(billing_date.gte.${fromDate},billing_date.lte.${toDate})`)
  } else if (fromDate) {
    query = query.gte('billing_date', fromDate)
  } else if (toDate) {
    query = query.lte('billing_date', toDate)
  }
  const { data, error } = await query.order('billing_date', { ascending: true })
  if (error) throw error
  return data
}

// Crear nueva facturación
export async function createBilling(bill) {
  const { data, error } = await supabase
    .from('billing')
    .insert([bill])
    .select()
    .single()
  if (error) throw error
  return data
}

// Eliminar tarea
export async function deletePlanningTask(id) {
  const { error } = await supabase.from('planning_task').delete().eq('id', id)
  if (error) throw error
}

// Actualizar tarea
export async function updatePlanningTask(id, updates) {
  const { data, error } = await supabase
    .from('planning_task')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Eliminar facturación
export async function deleteBilling(id) {
  const { error } = await supabase.from('billing').delete().eq('id', id)
  if (error) throw error
}

// Actualizar facturación
export async function updateBilling(id, updates) {
  const { data, error } = await supabase
    .from('billing')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
