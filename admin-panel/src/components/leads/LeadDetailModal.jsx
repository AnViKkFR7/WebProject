import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { formatDateTime } from '../../lib/dates'
import { LEAD_STATUSES } from '../../lib/leads'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import styles from './LeadDetailModal.module.css'

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi

const renderLinkedText = (value) => {
  if (!value) return null
  const parts = []
  let cursor = 0
  for (const match of value.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const trailing = raw.match(/[),.!?;:]+$/)?.[0] || ''
    const href = trailing ? raw.slice(0, -trailing.length) : raw
    const start = match.index
    if (start > cursor) parts.push(value.slice(cursor, start))
    parts.push(<a key={`${start}-${href}`} href={href} target="_blank" rel="noopener noreferrer">{href}</a>)
    if (trailing) parts.push(trailing)
    cursor = start + raw.length
  }
  if (cursor < value.length) parts.push(value.slice(cursor))
  return parts
}

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
      <div className={styles.content}>
      <section className={styles.contactCard} aria-label={t('leads.contactDetails')}>
        <div className={styles.sectionHeading}><Icon name="users" size={16} /><h4>{t('leads.contactDetails')}</h4></div>
        <dl className={styles.details}>
        {lead.email && (
          <div className={styles.detailRow}>
            <dt>{t('leads.email')}</dt>
            <dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
          </div>
        )}
        {lead.phone && (
          <div className={styles.detailRow}>
            <dt>{t('leads.phone')}</dt>
            <dd><a href={`tel:${lead.phone}`}>{lead.phone}</a></dd>
          </div>
        )}
        {lead.source_path && (
          <div className={styles.detailRow}>
            <dt>{t('leads.sourcePage')}</dt>
            <dd>{/^https?:\/\//i.test(lead.source_path)
              ? <a href={lead.source_path} target="_blank" rel="noopener noreferrer" className={styles.url}>{lead.source_path}<Icon name="external" size={13} /></a>
              : <code className={styles.path}>{lead.source_path}</code>}</dd>
          </div>
        )}
        {lead.source_campaign && (
          <div className={styles.detailRow}>
            <dt>{t('leads.campaign')}</dt>
            <dd><span className={styles.campaign}>{lead.source_campaign}</span></dd>
          </div>
        )}
        </dl>
      </section>

      {lead.message && (
        <section className={styles.messageCard}>
          <div className={styles.sectionHeading}><Icon name="mail" size={16} /><h4>{t('leads.message')}</h4></div>
          <p className={styles.message}>{renderLinkedText(lead.message)}</p>
        </section>
      )}

      <form
        id={formId}
        onSubmit={(e) => { e.preventDefault(); onSave(lead.id, { status, notes: notes.trim() || null }) }}
        className={styles.form}
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
      </div>
    </Modal>
  )
}

export default LeadDetailModal
