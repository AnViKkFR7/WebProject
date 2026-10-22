import { useId } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

const colors = ['#635bff','#2563eb','#0891b2','#0f766e','#16a34a','#d4a044','#ea580c','#e11d48','#9333ea','#475569']

export default function ColorSelector({ label, value, onChange }) {
  const id = useId()
  const { t } = useLanguage()
  return <fieldset className="color-selector">
    <legend className="field-label">{label}</legend>
    <div className="color-selector-swatches">{colors.map(color => <button key={color} type="button"
      style={{ '--swatch':color }} aria-label={color} aria-pressed={value?.toLowerCase() === color}
      onClick={() => onChange(color)}>{value?.toLowerCase() === color && <span aria-hidden="true">✓</span>}</button>)}</div>
    <label className="color-selector-hex" htmlFor={id}><span>{t('colorSelector.hex')}</span>
      <input id={id} className="input" type="text" value={value || ''} onChange={event => onChange(event.target.value)}
        required pattern="#[0-9a-fA-F]{6}" maxLength={7} placeholder="#635bff" spellCheck={false} autoComplete="off"/>
    </label>
    <span className="field-help">{t('colorSelector.help')}</span>
  </fieldset>
}
