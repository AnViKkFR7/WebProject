import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { formatDateTime } from '../../lib/dates'
import { LEAD_STATUSES } from '../../lib/leads'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'

/** Ficha de una solicitud: datos de contacto, mensaje, estado y notas internas. */
const LeadDetailModal = ({ lead, canEdit, saving, onSave, onDelete, onClose }) => {
  const { t } = useLanguage()
  const [status, setStatus] = useState(lead.status)
  const [notes, setNotes] = useState(lead.notes || '')
  const formId = 'lead-form'

  const dirty = status !== lead.status || notes !== (lead.notes || '')

  return (
    <Modal
      open
      onClose={onClose}
      title={lead.name}
      description={formatDateTime(lead.created_at)}
      footer={(
        <>
          {canEdit && (
            <button type="button" className="ghost-button modal-footer-start" onClick={() => onDelete(lead)}>
              <Icon name="trash" size={16} />{t('common.delete')}
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>{t('common.close')}</button>
          {canEdit && (
            <button type="submit" form={formId} className="primary-button" disabled={saving || !dirty}>
              {!saving && <Icon name="save" size={16} />}
              {saving ? t('common.savingChanges') : t('common.save')}
            </button>
          )}
        </>
      )}
    >
      <dl className="planning-form">
        {lead.email && (
          <div className="detail-row">
            <dt>{t('leads.email')}</dt>
            <dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
          </div>
        )}
        {lead.phone && (
          <div className="detail-row">
            <dt>{t('leads.phone')}</dt>
            <dd><a href={`tel:${lead.phone}`}>{lead.phone}</a></dd>
          </div>
        )}
        {lead.source_path && (
          <div className="detail-row">
            <dt>{t('leads.sourcePage')}</dt>
            <dd><code className="attr-row-key">{lead.source_path}</code></dd>
          </div>
        )}
        {lead.source_campaign && (
          <div className="detail-row">
            <dt>{t('leads.campaign')}</dt>
            <dd>{lead.source_campaign}</dd>
          </div>
        )}
      </dl>

      {lead.message && (
        <div className="field" style={{ marginTop: '1rem' }}>
          <span className="field-label">{t('leads.message')}</span>
          <p className="lead-message">{lead.message}</p>
        </div>
      )}

      <form
        id={formId}
        onSubmit={(e) => { e.preventDefault(); onSave(lead.id, { status, notes: notes.trim() || null }) }}
        style={{ marginTop: '1rem' }}
      >
        <div className="field">
          <label htmlFor="lead-status" className="field-label">{t('leads.status')}</label>
          <select
            id="lead-status"
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!canEdit}
          >
            {LEAD_STATUSES.map(value => (
              <option key={value} value={value}>{t(`leads.status_${value}`)}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="lead-notes" className="field-label">{t('leads.notes')}</label>
          <textarea
            id="lead-notes"
            className="input"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canEdit}
            placeholder={t('leads.notesPlaceholder')}
          />
          <p className="field-help">{t('leads.notesHelp')}</p>
        </div>
      </form>
    </Modal>
  )
}

export default LeadDetailModal
