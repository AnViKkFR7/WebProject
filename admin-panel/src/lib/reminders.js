// Recordatorios por email de una tarea: minutos antes del inicio.
// Se guardan en planning_task.reminders (int[]); los envía un cron en la base
// de datos (ver PLANNING_REMINDERS.sql).
export const REMINDER_OPTIONS = [
  { minutes: 0, labelKey: 'planning.reminderAtStart' },
  { minutes: 60, labelKey: 'planning.reminderHour' },
  { minutes: 1440, labelKey: 'planning.reminderDay' },
  { minutes: 10080, labelKey: 'planning.reminderWeek' },
]

const VALID = new Set(REMINDER_OPTIONS.map((option) => option.minutes))

/** Normaliza lo que llega de la base de datos o del formulario */
export function normalizeReminders(reminders) {
  if (!Array.isArray(reminders)) return []
  return [...new Set(reminders.map(Number).filter((m) => VALID.has(m)))].sort((a, b) => a - b)
}

/** Añade o quita un recordatorio */
export function toggleReminder(reminders, minutes) {
  const current = normalizeReminders(reminders)
  return normalizeReminders(
    current.includes(minutes) ? current.filter((m) => m !== minutes) : [...current, minutes],
  )
}

/** Momento en que se enviaría un recordatorio */
export function reminderSendAt(startDatetime, minutes) {
  const start = new Date(startDatetime)
  if (isNaN(start.getTime())) return null
  return new Date(start.getTime() - minutes * 60000)
}
