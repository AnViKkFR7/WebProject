import {
  endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns'

const WEEK = { weekStartsOn: 1 }

/**
 * Rango visible del calendario según la vista. Se usa para pedir a la base de
 * datos solo ese tramo: antes se descargaba todo el histórico de tareas.
 * Se añade un margen de una semana a cada lado para que al cambiar de página
 * no haya un hueco sin datos mientras llega la consulta nueva.
 */
export function visibleRange(view, date, marginDays = 7) {
  const base = new Date(date)
  let from
  let to
  if (view === 'month') {
    from = startOfWeek(startOfMonth(base), WEEK)
    to = endOfWeek(endOfMonth(base), WEEK)
  } else if (view === 'week') {
    from = startOfWeek(base, WEEK)
    to = endOfWeek(base, WEEK)
  } else {
    from = startOfDay(base)
    to = endOfDay(base)
  }
  const margin = marginDays * 24 * 60 * 60 * 1000
  return {
    from: new Date(from.getTime() - margin).toISOString(),
    to: new Date(to.getTime() + margin).toISOString(),
  }
}

/** Fecha (sin hora) para columnas `date` como billing.billing_date */
export const toDateOnly = (iso) => iso.slice(0, 10)
