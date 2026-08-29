import { useState } from 'react'
import Button from '../Button'
import { useLanguage } from '../../contexts/LanguageContext'

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

  if (!show) return null

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('analytics.newEvent')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            {t('analytics.newEventHelp')}
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              {t('analytics.eventLabel')} *
            </label>
            <input
              type="text"
              className="input"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder={t('analytics.eventLabelPlaceholder')}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              {t('analytics.eventKey')} *
            </label>
            <input
              type="text"
              className="input"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="whatsapp_click"
              style={{ width: '100%', fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              {t('analytics.eventKeyHelp')}
            </p>
          </div>

          {key && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '6px',
              background: 'var(--bg-table-header)',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              overflowX: 'auto'
            }}>
              data-track-event="{key}"
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--danger, #dc2626)', fontSize: '0.875rem', marginTop: '1rem' }}>
              {error}
            </p>
          )}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" size="medium" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="medium" onClick={handleSave} disabled={loading}>
            {loading ? t('common.savingChanges') : `💾 ${t('common.saveChanges')}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CreateEventDefinitionModal
