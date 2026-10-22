import { useId, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import {
  ATTRIBUTE_TYPES,
  parseLabel,
  serializeLabel,
  storageFieldsFor,
  uiTypeOf,
  uniqueKey,
} from '../../lib/attributeTypes'
import Modal from '../ui/Modal'
import Toggle from '../ui/Toggle'
import Icon from '../ui/Icon'
import OptionsEditor from './OptionsEditor'

// Tipos que comparten columna (value_text): se puede pasar de uno a otro sin perder valores
const TEXT_FAMILY = new Set(['text', 'options'])

/**
 * Panel lateral para crear o editar un atributo. El padre lo monta con un `key`
 * distinto por atributo, así el estado inicial sale siempre de `definition`.
 */
const AttributeEditor = ({ open, definition, existingKeys, valueCount, saving, onSave, onClose }) => {
  const { t } = useLanguage()
  const formId = useId()
  const isNew = !definition
  const initialLabel = parseLabel(definition?.label)
  const initialType = uiTypeOf(definition)

  const [es, setEs] = useState(initialLabel.es)
  const [en, setEn] = useState(initialLabel.en)
  const [uiType, setUiType] = useState(isNew ? 'text' : initialType)
  const [options, setOptions] = useState(definition?.validation_rules?.options?.length ? definition.validation_rules.options : [''])
  const [isRequired, setIsRequired] = useState(definition?.is_required ?? false)
  const [isFilterable, setIsFilterable] = useState(definition?.is_filterable ?? false)
  const [error, setError] = useState(null)

  const key = isNew ? uniqueKey(es, existingKeys) : definition.key
  const hasValues = !isNew && valueCount > 0
  const allowedTypes = hasValues
    ? ATTRIBUTE_TYPES.filter((type) => type.value === initialType || (TEXT_FAMILY.has(initialType) && TEXT_FAMILY.has(type.value)))
    : ATTRIBUTE_TYPES

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!es.trim()) {
      setError(t('attributes.labelRequired'))
      return
    }
    if (uiType === 'options' && !options.some((option) => option.trim())) {
      setError(t('attributes.optionsRequired'))
      return
    }
    setError(null)
    onSave({
      key,
      label: serializeLabel({ es, en }),
      is_required: isRequired,
      is_filterable: isFilterable,
      ...storageFieldsFor(uiType, options),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="modal-drawer"
      overlayClassName="modal-overlay-drawer"
      title={isNew ? t('attributes.newAttribute') : t('attributes.editAttribute')}
      footer={(
        <>
          <button type="button" className="ghost-button" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form={formId} className="primary-button" disabled={saving}>
            {!saving && <Icon name="save" size={16} />}
            {saving ? t('common.savingChanges') : t('common.save')}
          </button>
        </>
      )}
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <div className="field">
            <label htmlFor={`${formId}-es`} className="field-label">
              {t('attributes.labelEs')}<span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input id={`${formId}-es`} className="input" value={es} onChange={(e) => setEs(e.target.value)} required lang="es" />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-en`} className="field-label">{t('attributes.labelEn')}</label>
            <input id={`${formId}-en`} className="input" value={en} onChange={(e) => setEn(e.target.value)} lang="en" />
          </div>
        </div>
        <p className="field-help field-help-tight">{t('attributes.labelHelp')}</p>

        <div className="field">
          <span className="field-label">{t('attributes.key')}</span>
          <code className="code-snippet attr-key-preview">{key || '—'}</code>
          <p className="field-help">{isNew ? t('attributes.keyHelpNew') : t('attributes.keyHelpExisting')}</p>
        </div>

        <div className="field">
          <label htmlFor={`${formId}-type`} className="field-label">{t('attributes.type')}</label>
          <select
            id={`${formId}-type`}
            className="select"
            value={uiType}
            onChange={(e) => setUiType(e.target.value)}
            disabled={allowedTypes.length === 1}
            aria-describedby={hasValues ? `${formId}-type-help` : undefined}
          >
            {allowedTypes.map((type) => (
              <option key={type.value} value={type.value}>{t(`attributes.types.${type.value}`)}</option>
            ))}
          </select>
          {hasValues && (
            <p id={`${formId}-type-help`} className="field-help">
              {t(allowedTypes.length > 1 ? 'attributes.typeLimited' : 'attributes.typeLocked').replace('{count}', valueCount)}
            </p>
          )}
        </div>

        {uiType === 'options' && <OptionsEditor options={options} onChange={setOptions} />}

        <div className="field attr-editor-switches">
          <Toggle
            checked={isRequired}
            onChange={setIsRequired}
            label={t('attributes.required')}
            description={t('attributes.requiredHelp')}
          />
          <Toggle
            checked={isFilterable}
            onChange={setIsFilterable}
            label={t('attributes.filterable')}
            description={t('attributes.filterableHelp')}
          />
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}

export default AttributeEditor
