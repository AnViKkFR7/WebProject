import {visibleRange} from './planningRange'
import {recurrenceOccurrence} from './planningRecurrenceTime'

const types=new Set(['hourly','daily','weekly','yearly'])
const dateOnly=/^\d{4}-\d{2}-\d{2}$/

/** Expand only the requested calendar window. Keys retain the series index. */
export function expandRecurringItem(item,dateField='start_datetime',endField='end_datetime',range){
  if(!types.has(item.recurrence_type)||!item[dateField])return [item]
  const start=new Date(item[dateField])
  if(!Number.isFinite(start.getTime()))return [item]
  const window=range||visibleRange('month',new Date())
  const from=new Date(window.from).getTime(),to=new Date(window.to).getTime()+(dateOnly.test(window.to)?86400000-1:0)
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from||to-from>93*86400000)throw new RangeError('Invalid recurrence window')
  const value=Number(item.recurrence_value)
  const every=Number.isInteger(value)&&value>0?value:1
  const onlyDate=dateOnly.test(item[dateField])
  const occurrence=index=>recurrenceOccurrence(start,item.recurrence_type,every,index,onlyDate)
  const time=index=>{const value=occurrence(index).getTime();return Number.isFinite(value)?value:Infinity}
  // Binary search skips old repetitions without scanning the series history.
  let low=0,high=1
  while(time(high)<from)high*=2
  while(low<high){const middle=Math.floor((low+high)/2);if(time(middle)<from)low=middle+1;else high=middle}
  const end=item[endField]?new Date(item[endField]):null
  const duration=end&&Number.isFinite(end.getTime())?end.getTime()-start.getTime():null
  const format=date=>onlyDate?date.toISOString().slice(0,10):date.toISOString()
  const result=[]
  for(let index=low;;index++){
    const date=occurrence(index)
    if(!Number.isFinite(date.getTime())||date.getTime()>to)break
    result.push({...item,
      ...(dateField==='start_datetime'?{_seriesStart:item[dateField],_seriesEnd:endField?item[endField]:null}:{}),
      [dateField]:format(date),
      ...(endField&&item[endField]&&duration!==null?{[endField]:format(new Date(date.getTime()+duration))}:{}),
      _occurrenceKey:`${item.id}::${index}`,_isRecurrenceInstance:index>0,
    })
  }
  return result
}
export const expandRecurringTasks=(tasks,range)=>tasks.flatMap(task=>expandRecurringItem(task,'start_datetime','end_datetime',range))
export const expandRecurringBills=(bills,range)=>bills.flatMap(bill=>expandRecurringItem(bill,'billing_date',null,range))

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
