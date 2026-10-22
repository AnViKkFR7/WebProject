import { format } from 'date-fns'
import { toLocalInputValue } from './dates'

export function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const [year,month,day]=value.split('-').map(Number)
  if (!year) return null
  const date=new Date(0)
  date.setFullYear(year,month-1,day); date.setHours(12,0,0,0)
  return date.getFullYear()===year && date.getMonth()===month-1 && date.getDate()===day ? date : null
}
export const calendarISO = date => format(date,'yyyy-MM-dd')
export const displayDateInput = value => calendarDate(value) ? value.split('-').reverse().join('/') : ''
export function parseDateInput(value) {
  if (!value.trim()) return ''
  if (calendarDate(value)) return value
  const match=/^(\d{2})\/?(\d{2})\/?(\d{4})$/.exec(value.trim())
  const iso=match ? `${match[3]}-${match[2]}-${match[1]}` : ''
  return calendarDate(iso) ? iso : null
}
export function taskHourLater(value) {
  const date=new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  // Add an hour on the local clock, including midnight and DST transitions.
  date.setHours(date.getHours()+1)
  return toLocalInputValue(date)
}

// Automatic ends follow start edits; a valid custom end is preserved. Moving past
// a custom end proposes a fresh hour rather than leaving an impossible interval.
export function changeTaskStart(form,start) {
  const automatic=!form.end_datetime || form.end_datetime===taskHourLater(form.start_datetime)
  return { ...form,start_datetime:start,end_datetime:!start ? '' : automatic || form.end_datetime<=start ? taskHourLater(start) : form.end_datetime }
}
