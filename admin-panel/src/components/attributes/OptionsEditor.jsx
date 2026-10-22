import { useRef } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import Icon from '../ui/Icon'

/** Lista editable de opciones para el tipo "Lista de opciones". */
const OptionsEditor = ({ options, onChange }) => {
  const { t } = useLanguage()
  const listRef = useRef(null)

  const update = (index, value) => onChange(options.map((option, i) => (i === index ? value : option)))
  const remove = (index) => onChange(options.filter((_, i) => i !== index))

  const add = () => {
    onChange([...options, ''])
    // El campo nuevo recibe el foco para escribir sin tocar el ratón
    requestAnimationFrame(() => listRef.current?.querySelector('li:last-child input')?.focus())
  }

  const onKeyDown = (event, index) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (index === options.length - 1) add()
      else listRef.current?.querySelectorAll('input')[index + 1]?.focus()
    }
  }

  return (
    <fieldset className="options-editor">
      <legend className="field-label">{t('attributes.options')}</legend>
      <ol className="options-editor-list" ref={listRef}>
        {options.map((option, index) => (
          <li key={index}>
            <span className="options-editor-index" aria-hidden="true">{index + 1}</span>
            <input
              type="text"
              className="input"
              value={option}
              onChange={(e) => update(index, e.target.value)}
              onKeyDown={(e) => onKeyDown(e, index)}
              placeholder={t('attributes.optionPlaceholder')}
              aria-label={t('attributes.optionNumber').replace('{n}', index + 1)}
            />
            <button
              type="button"
              className="icon-button danger"
              onClick={() => remove(index)}
              aria-label={t('attributes.removeOption').replace('{n}', index + 1)}
            >
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="ghost-button small" onClick={add}>
        <Icon name="plus" size={14} />
        {t('attributes.addOption')}
      </button>
    </fieldset>
  )
}

export default OptionsEditor
