import { addHours, addDays, addWeeks, addYears, format } from 'date-fns'

// billing_date es una columna `date` (sin hora) — hay que devolverla como
// 'yyyy-MM-dd', no como datetime ISO completo, o se rompe todo lo que la
// muestra/ordena como texto de fecha simple.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
function formatLike(original, date) {
  return DATE_ONLY_RE.test(original) ? format(date, 'yyyy-MM-dd') : date.toISOString()
}

const STEP_BY_TYPE = {
  hourly: addHours,
  daily: addDays,
  weekly: addWeeks,
  yearly: addYears,
}

// Límites de seguridad: ninguna tarea recurrente genera ocurrencias más
// allá de este número o de este horizonte temporal, lo que ocurra antes.
// Evita que una recurrencia horaria/diaria antigua genere miles de eventos.
const MAX_OCCURRENCES = 200
const MAX_HORIZON_YEARS = 3

/**
 * Expande una tarea (o factura) con recurrencia en sus ocurrencias
 * virtuales, una por cada repetición dentro del horizonte de seguridad.
 * Una tarea sin recurrencia (o con recurrence_type 'none') se devuelve
 * como su única ocurrencia, sin cambios.
 *
 * Cada ocurrencia es un clon superficial del original con las fechas
 * desplazadas y un `_occurrenceKey` único (para usar como key de React —
 * varias ocurrencias comparten el mismo `id`, el de la fila real en la
 * base de datos, a propósito: editar o borrar una ocurrencia opera sobre
 * la serie completa, no crea excepciones puntuales).
 */
export function expandRecurringItem(item, dateField = 'start_datetime', endField = 'end_datetime') {
  const step = STEP_BY_TYPE[item.recurrence_type]
  if (!step || !item[dateField]) {
    return [item]
  }

  const every = item.recurrence_value && item.recurrence_value > 0 ? item.recurrence_value : 1
  const start = new Date(item[dateField])
  if (isNaN(start.getTime())) return [item]

  const end = item[endField] ? new Date(item[endField]) : null
  const durationMs = end && !isNaN(end.getTime()) ? end.getTime() - start.getTime() : null
  const horizon = addYears(new Date(), MAX_HORIZON_YEARS)

  const occurrences = []
  for (let index = 0; index < MAX_OCCURRENCES; index++) {
    const occurrenceStart = step(start, every * index)
    if (occurrenceStart > horizon) break

    const occurrenceEnd = durationMs !== null ? new Date(occurrenceStart.getTime() + durationMs) : null
    occurrences.push({
      ...item,
      [dateField]: formatLike(item[dateField], occurrenceStart),
      ...(endField && item[endField]
        ? { [endField]: occurrenceEnd ? formatLike(item[endField], occurrenceEnd) : item[endField] }
        : {}),
      _occurrenceKey: `${item.id}::${index}`,
      _isRecurrenceInstance: index > 0,
    })
  }

  return occurrences.length > 0 ? occurrences : [item]
}

export function expandRecurringTasks(tasks) {
  return tasks.flatMap((task) => expandRecurringItem(task, 'start_datetime', 'end_datetime'))
}

export function expandRecurringBills(bills) {
  return bills.flatMap((bill) => expandRecurringItem(bill, 'billing_date', null))
}

// [clave singular, clave plural] por tipo — "cada 1 semana" vs "cada 2
// semanas". Compartido entre RecurrenceFields (formulario) y las vistas de
// detalle de tarea/factura (solo lectura), para que ambas hablen igual.
export const RECURRENCE_UNIT_KEYS = {
  hourly: ['unitHour', 'unitHours'],
  daily: ['unitDay', 'unitDays'],
  weekly: ['unitWeek', 'unitWeeks'],
  yearly: ['unitYear', 'unitYears'],
}

// Texto de solo lectura: "cada 2 semanas". Devuelve '' si no hay
// recurrencia o el tipo no se reconoce.
export function formatRecurrence(type, value, t) {
  const keys = RECURRENCE_UNIT_KEYS[type]
  if (!keys) return ''
  const n = value && value > 0 ? value : 1
  const [singular, plural] = keys
  return `${t('planning.every')} ${n} ${t(`planning.${n === 1 ? singular : plural}`)}`
}
