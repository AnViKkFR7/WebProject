import { useId, useState } from 'react'
import DatePicker from './DatePicker'
import { useLanguage } from '../contexts/LanguageContext'

export default function BillingField({ name, label, value, onChange, options = {} }) {
  const id = useId()
  const [error, setError] = useState('')
  const { t } = useLanguage()
  const change = next => { setError(''); onChange(next) }
  const accessibility = { 'aria-invalid':error ? true : undefined, 'aria-describedby':error ? id : undefined }
  return <label className="field invoice-field" data-field={name} onInvalidCapture={event => {
    event.preventDefault()
    const input=event.target
    const validity=input.validity
    setError(validity.valueMissing ? t('documentWorkspace.required')
      : validity.typeMismatch ? t('documentWorkspace.emailError')
      : validity.rangeUnderflow ? `${t('documentWorkspace.minimum')} ${input.min}`
      : validity.rangeOverflow ? `${t('documentWorkspace.maximum')} ${input.max}`
      : validity.stepMismatch ? `${t('documentWorkspace.step')} ${input.step}`
      : validity.customError ? input.validationMessage : t('documentWorkspace.formatError'))
  }} onChangeCapture={() => setError('')}>
    <span className="field-label">{label}{options.required ? ' *' : ''}</span>
    {options.type === 'date'
      ? <DatePicker {...accessibility} value={value || ''} onChange={change} label={label} required={options.required} min={options.min} disabled={options.disabled}/>
      : <input className="input" {...accessibility} value={value ?? ''} onChange={event => change(event.target.value)} {...options}/>}
    {error && <span id={id} className="field-error">{error}</span>}
  </label>
}
