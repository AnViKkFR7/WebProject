import { useState } from 'react'
import Button from '../Button'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import { useLanguage } from '../../contexts/LanguageContext'
import { isReservedEventKey } from '../../lib/analyticsEvents'

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const CreateEventDefinitionModal = ({ show, loading, existingKeys, onClose, onSave }) => {
  const { t } = useLanguage()
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [keyEditedByUser, setKeyEditedByUser] = useState(false)
  const [error, setError] = useState(null)

  const handleLabelChange = (value) => {
    setLabel(value)
    if (!keyEditedByUser) setKey(slugify(value))
  }

  const handleKeyChange = (value) => {
    setKeyEditedByUser(true)
    setKey(slugify(value))
  }

  const handleSave = async () => {
    setError(null)
    if (!label.trim() || !key.trim()) {
      setError(t('analytics.eventValidationRequired'))
      return
    }
    // Las reservadas ya se miden solas en todas las empresas: registrarlas
    // aquí no haría nada y confundiría el recuento.
    if (isReservedEventKey(key)) {
      setError(t('analytics.eventValidationReserved'))
      return
    }
    if (existingKeys.includes(key)) {
      setError(t('analytics.eventValidationDuplicate'))
      return
    }
    try {
      await onSave({ key, label: label.trim() })
      setLabel('')
      setKey('')
      setKeyEditedByUser(false)
    } catch (err) {
      setError(err.message || t('analytics.eventSaveError'))
    }
  }

  return (
    <Modal
      open={show}
      onClose={onClose}
      title={t('analytics.newEvent')}
      description={t('analytics.newEventHelp')}
      footer={(
        <>
          <Button variant="ghost" size="medium" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="medium" onClick={handleSave} disabled={loading}>
            {!loading && <Icon name="save" size={16} />}
            {loading ? t('common.savingChanges') : t('common.saveChanges')}
          </Button>
        </>
      )}
    >
      <div className="field">
        <label htmlFor="event-label" className="field-label">
          {t('analytics.eventLabel')}<span className="required-mark" aria-hidden="true">*</span>
        </label>
        <input
          id="event-label"
          type="text"
          className="input"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={t('analytics.eventLabelPlaceholder')}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="event-key" className="field-label">
          {t('analytics.eventKey')}<span className="required-mark" aria-hidden="true">*</span>
        </label>
        <input
          id="event-key"
          type="text"
          className="input input-mono"
          value={key}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="whatsapp_click"
          aria-describedby="event-key-help"
          required
        />
        <p id="event-key-help" className="field-help">{t('analytics.eventKeyHelp')}</p>
      </div>

      {key && <div className="code-snippet">data-track-event="{key}"</div>}

      {error && <p className="field-error" role="alert">{error}</p>}
    </Modal>
  )
}

export default CreateEventDefinitionModal
