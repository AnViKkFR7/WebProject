import { format } from 'date-fns'

// Las columnas de fecha-hora de Planning son `timestamptz`. Si se les envía
// '2026-10-21T10:00' sin zona, Postgres lo interpreta como UTC, y luego al
// pintarlo en hora local aparecía 1-2 h desplazado. Regla: el formulario
// trabaja en hora local ('yyyy-MM-ddTHH:mm'); a la base de datos va siempre
// ISO con zona; y para mostrar se formatea desde Date, nunca cortando el texto.

const LOCAL_INPUT = "yyyy-MM-dd'T'HH:mm"

function toDate(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

// Valor de formulario en hora local → ISO UTC para guardar
export function localInputToISO(localValue) {
  const date = toDate(localValue)
  return date ? date.toISOString() : null
}

// Lo que viene de la base de datos (o un Date) → valor de formulario local
export function toLocalInputValue(value) {
  const date = toDate(value)
  return date ? format(date, LOCAL_INPUT) : ''
}

// Date-only form values must use the browser's calendar day, not the UTC day.
export function toLocalDateInputValue(value) {
  const date = toDate(value)
  return date ? format(date, 'yyyy-MM-dd') : ''
}

export function formatTime(value) {
  const date = toDate(value)
  return date ? format(date, 'HH:mm') : ''
}

export function formatDateTime(value) {
  const date = toDate(value)
  return date ? format(date, 'dd/MM/yyyy HH:mm') : ''
}
