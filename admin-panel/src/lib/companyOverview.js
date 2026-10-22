// Resumen de la empresa que se pinta en el Dashboard.
// Aquí solo va la parte de cálculo, sin llamadas a la base de datos, para
// poder probarla.

export const ITEM_STATUSES = ['draft', 'published', 'archived']
export const MEMBER_ROLES = ['admin', 'editor', 'viewer']

/** Cuenta cuántas filas hay de cada valor, con las claves conocidas siempre presentes */
export function countBy(rows, key, knownValues = []) {
  const counts = Object.fromEntries(knownValues.map((value) => [value, 0]))
  for (const row of rows || []) {
    const value = row?.[key]
    if (value == null) continue
    counts[value] = (counts[value] || 0) + 1
  }
  return counts
}

/** Suma de facturas pendientes, separando lo que se cobra de lo que se paga */
export function sumBilling(bills) {
  let toReceive = 0
  let toPay = 0
  for (const bill of bills || []) {
    const amount = Number(bill?.amount) || 0
    if (bill?.direction === 'cobrar') toReceive += amount
    else if (bill?.direction === 'pagar') toPay += amount
  }
  return { toReceive, toPay, balance: toReceive - toPay }
}

/** Tipos de item distintos a partir de las definiciones de atributos */
export function distinctItemTypes(definitions) {
  return [...new Set((definitions || []).map((d) => d?.item_type).filter(Boolean))]
}

/** Las N tareas que vienen primero, ya ordenadas por fecha */
export function nextTasks(tasks, limit = 5, now = new Date()) {
  return (tasks || [])
    .filter((task) => task?.start_datetime && new Date(task.start_datetime) >= now)
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
    .slice(0, limit)
}

/** Porcentaje entero sobre el total, sin dividir por cero */
export const percentOf = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0)
