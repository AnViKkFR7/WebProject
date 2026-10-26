import { useId } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import styles from './ColorSelector.module.css'

const colors = ['#635bff','#2563eb','#0891b2','#0f766e','#16a34a','#d4a044','#ea580c','#e11d48','#9333ea','#475569']

export default function ColorSelector({ label, value, onChange, samples=colors, disabledReason, help, error }) {
  const id = useId()
  const { t } = useLanguage()
  return <fieldset className="color-selector">
    <legend className="field-label">{label}</legend>
    <div className="color-selector-swatches">{samples.map(color => {
      const reason=disabledReason?.(color)
      return <button key={color} type="button" disabled={Boolean(reason)} data-unavailable={Boolean(reason)} className={styles.swatch}
        style={{ '--swatch':color }} aria-label={reason ? `${color}: ${reason}` : color} title={reason || color} aria-pressed={value?.toLowerCase() === color}
        onClick={() => onChange(color)}>{value?.toLowerCase() === color && <span className={styles.selected} aria-hidden="true">✓</span>}</button>
    })}</div>
    <label className="color-selector-hex" htmlFor={id}><span>{t('colorSelector.hex')}</span>
      <input id={id} className="input" type="text" value={value || ''} onChange={event => onChange(event.target.value)}
        required pattern="#[0-9a-fA-F]{6}" maxLength={7} placeholder="#635bff" spellCheck={false} autoComplete="off"
        aria-invalid={error ? true : undefined} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}/>
    </label>
    <span id={`${id}-help`} className="field-help">{help || t('colorSelector.help')}</span>
    {error && <span id={`${id}-error`} className="field-error">{error}</span>}
  </fieldset>
}
