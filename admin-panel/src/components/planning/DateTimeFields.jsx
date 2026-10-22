import DatePicker from '../DatePicker'
import { useLanguage } from '../../contexts/LanguageContext'

export default function DateTimeFields({value,onChange,required=false,label,min,defaultValue}) {
  const {t}=useLanguage()
  const date=value?.slice(0,10) || ''
  const time=value ? value.slice(11,16) : defaultValue?.slice(11,16) || '09:00'
  return <div className="datetime-fields task-datetime-fields">
    <DatePicker value={date} onChange={next=>onChange(next ? `${next}T${time}` : '')} required={required} label={label} min={min?.slice(0,10)}/>
    <input type="time" className="input datetime-clock" aria-label={`${label} · ${t('dateInput.time')}`} value={time}
      disabled={!date} step="60" required={required || Boolean(date)} min={date===min?.slice(0,10) ? min.slice(11,16) : undefined}
      onChange={event=>onChange(`${date}T${event.target.value}`)}/>
  </div>
}
