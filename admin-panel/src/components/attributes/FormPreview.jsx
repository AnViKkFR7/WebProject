import DatePicker from '../DatePicker'
import { useLanguage } from '../../contexts/LanguageContext'
import { parseLabel, uiTypeOf } from '../../lib/attributeTypes'

/** Cómo verá el formulario quien cree un item de este tipo. Solo lectura. */
const PreviewField = ({ definition }) => {
  const { t } = useLanguage()
  const uiType = uiTypeOf(definition)

  switch (uiType) {
    case 'longtext':
      return <textarea className="input" rows={3} disabled tabIndex={-1} />
    case 'boolean':
      return (
        <select className="select" disabled tabIndex={-1}>
          <option>{t('items.selectOption')}</option>
        </select>
      )
    case 'options':
      return (
        <select className="select" disabled tabIndex={-1}>
          <option>{definition.validation_rules.options[0] || t('items.selectOptionGeneric')}</option>
        </select>
      )
    case 'date':
      return <DatePicker disabled onChange={()=>{}} tabIndex={-1}/>
    case 'integer':
    case 'decimal':
      return <input className="input" placeholder={uiType === 'decimal' ? '0.00' : '0'} disabled tabIndex={-1} />
    case 'text_array':
    case 'number_array':
      return <input className="input" placeholder={t('attributes.previewList')} disabled tabIndex={-1} />
    default:
      return <input className="input" disabled tabIndex={-1} />
  }
}

const FormPreview = ({ definitions }) => {
  const { t } = useLanguage()

  return (
    <aside className="form-preview" aria-label={t('attributes.preview')}>
      <h3 className="form-preview-title">{t('attributes.preview')}</h3>
      <p className="form-preview-help">{t('attributes.previewHelp')}</p>
      <div className="form-preview-body" aria-hidden="true">
        {definitions.map((definition) => (
          <div key={definition.id} className="form-preview-field">
            <span className="field-label">
              {parseLabel(definition.label).es || definition.key}
              {definition.is_required && <span className="required-mark">*</span>}
            </span>
            <PreviewField definition={definition} />
          </div>
        ))}
      </div>
    </aside>
  )
}

export default FormPreview
