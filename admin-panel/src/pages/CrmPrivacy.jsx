import { useEffect, useState } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { Link } from 'react-router-dom'
import { crmPrivacyService } from '../services/crmPrivacyService'
import Icon from '../components/ui/Icon'
import PageHeader from '../components/ui/PageHeader'
import styles from './CrmPrivacy.module.css'

const newRequestId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map(value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export default function CrmPrivacy() {
  const { selectedCompany } = useCompany()
  const { canManagePrivacy } = usePermissions()
  const { t } = useLanguage()
  const { toast } = useFeedback()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [contact, setContact] = useState(null)
  const [impact, setImpact] = useState(null)
  const [showEraseConfirm, setShowEraseConfirm] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [retention, setRetention] = useState({ unresolved_lead_days: '', inactive_contact_days: '', unresolved_leads_for_review: 0, inactive_contacts_for_review: 0 })
  const [retentionCompanyId, setRetentionCompanyId] = useState(null)
  const [retentionLoading, setRetentionLoading] = useState(false)
  const [retentionSaving, setRetentionSaving] = useState(false)
  const [retentionError, setRetentionError] = useState('')
  const [retentionSaved, setRetentionSaved] = useState(false)
  const companyId = selectedCompany?.id

  useEffect(() => {
    if (!companyId || !canManagePrivacy) return undefined
    let active = true
    setRetentionCompanyId(null)
    setRetentionLoading(true); setRetentionError('')
    crmPrivacyService.getRetentionReview(companyId)
      .then(value => { if (active) { setRetention({ ...value, unresolved_lead_days: value.unresolved_lead_days ?? '', inactive_contact_days: value.inactive_contact_days ?? '' }); setRetentionCompanyId(companyId) } })
      .catch(() => { if (active) setRetentionError('load') })
      .finally(() => { if (active) setRetentionLoading(false) })
    return () => { active = false }
  }, [companyId, canManagePrivacy])

  const saveRetention = async (event) => {
    event.preventDefault()
    if (!companyId) return
    setRetentionSaving(true); setRetentionError(''); setRetentionSaved(false)
    const days = value => value === '' ? null : Number(value)
    try {
      const saved = await crmPrivacyService.saveRetentionReview(companyId, days(retention.unresolved_lead_days), days(retention.inactive_contact_days))
      setRetention({ ...saved, unresolved_lead_days: saved.unresolved_lead_days ?? '', inactive_contact_days: saved.inactive_contact_days ?? '' })
      setRetentionCompanyId(companyId)
      setRetentionSaved(true)
    } catch { setRetentionError('save') }
    finally { setRetentionSaving(false) }
  }

  const search = async (event) => {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 2 || !companyId) return
    setLoading(true); setError(''); setContact(null); setImpact(null); setShowEraseConfirm(false); setConfirmed(false); setComplete(false)
    try { setResults(await crmPrivacyService.searchContacts(companyId, term)) }
    catch { setError(t('crmPrivacy.searchError')); setResults([]) }
    finally { setLoading(false) }
  }

  const selectContact = async (row) => {
    setContact(row); setImpact(null); setShowEraseConfirm(false); setConfirmed(false); setComplete(false); setLoading(true); setError('')
    try { setImpact(await crmPrivacyService.preview(companyId, row.id)) }
    catch { setError(t('crmPrivacy.previewError')) }
    finally { setLoading(false) }
  }

  const exportContact = async () => {
    if (!contact || !companyId) return
    setLoading(true); setError('')
    try {
      const data = await crmPrivacyService.exportContact(companyId, contact.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `contacto-${contact.id}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(t('crmPrivacy.exported'))
    } catch { setError(t('crmPrivacy.exportError')) }
    finally { setLoading(false) }
  }

  const anonymize = async () => {
    if (!contact || !companyId || !confirmed) return
    setLoading(true); setError('')
    try {
      await crmPrivacyService.anonymize(companyId, contact.id, newRequestId())
      setResults(current => current.filter(row => row.id !== contact.id))
      setContact(null); setImpact(null); setShowEraseConfirm(false); setConfirmed(false); setComplete(true)
      toast.success(t('crmPrivacy.anonymized'))
    } catch { setError(t('crmPrivacy.anonymizeError')) }
    finally { setLoading(false) }
  }

  const retentionReady = retentionCompanyId === companyId
  if (!companyId) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>
  if (!canManagePrivacy) return <div className="page-content"><div className="error-state" role="alert">{t('crmPrivacy.adminOnly')}</div></div>

  return <div className="page-content">
    <PageHeader title={t('crmPrivacy.title')} description={t('crmPrivacy.description')} />
    <section className={styles.notice} aria-label={t('crmPrivacy.important')}>
      <Icon name="alert" size={19} />
      <div><strong>{t('crmPrivacy.important')}</strong><p>{t('crmPrivacy.retentionNote')}</p><p>{t('crmPrivacy.billingNote')}</p><p>{t('crmPrivacy.billingLinkGap')}</p></div>
    </section>
    <section className={styles.retention} aria-labelledby="crm-retention-title">
      <div className={styles.retentionHeading}><div><h2 id="crm-retention-title">{t('crmPrivacy.retentionTitle')}</h2><p>{t('crmPrivacy.retentionDescription')}</p></div></div>
      <p className={styles.retentionNote}>{t('crmPrivacy.retentionManualOnly')}</p>
      <form onSubmit={saveRetention}>
        <div className={styles.retentionFields}>
          <label className="field"><span className="field-label">{t('crmPrivacy.unresolvedLeadDays')}</span><input className="input" type="number" min="1" max="3650" step="1" value={retentionReady ? retention.unresolved_lead_days : ''} onChange={event => { setRetention(previous => ({ ...previous, unresolved_lead_days: event.target.value })); setRetentionSaved(false) }} disabled={!retentionReady || retentionLoading || retentionSaving} placeholder={t('crmPrivacy.noRetentionPeriod')} /><small>{t('crmPrivacy.unresolvedLeadHelp')}</small></label>
          <label className="field"><span className="field-label">{t('crmPrivacy.inactiveContactDays')}</span><input className="input" type="number" min="1" max="3650" step="1" value={retentionReady ? retention.inactive_contact_days : ''} onChange={event => { setRetention(previous => ({ ...previous, inactive_contact_days: event.target.value })); setRetentionSaved(false) }} disabled={!retentionReady || retentionLoading || retentionSaving} placeholder={t('crmPrivacy.noRetentionPeriod')} /><small>{t('crmPrivacy.inactiveContactHelp')}</small></label>
        </div>
        <div className={styles.retentionCounts} aria-live="polite">
          <p><strong>{retentionReady && retention.unresolved_lead_days !== '' ? retention.unresolved_leads_for_review || 0 : '—'}</strong><span>{t('crmPrivacy.unresolvedLeadsDue')}</span><Link to="/contacts">{t('crmPrivacy.reviewRequests')}</Link></p>
          <p><strong>{retentionReady && retention.inactive_contact_days !== '' ? retention.inactive_contacts_for_review || 0 : '—'}</strong><span>{t('crmPrivacy.inactiveContactsDue')}</span><a href="#crm-privacy-search">{t('crmPrivacy.searchContact')}</a></p>
        </div>
        {retentionLoading && <p role="status">{t('common.loading')}</p>}
        {retentionError && <p className={styles.retentionError} role="alert">{t(retentionError === 'load' ? 'crmPrivacy.retentionLoadError' : 'crmPrivacy.retentionSaveError')}</p>}
        {retentionSaved && <p className={styles.retentionSaved} role="status">{t('crmPrivacy.retentionSaved')}</p>}
        <button className="primary-button" type="submit" disabled={!retentionReady || retentionLoading || retentionSaving}>{retentionSaving ? t('common.savingChanges') : t('crmPrivacy.saveRetention')}</button>
      </form>
    </section>
    <form id="crm-privacy-search" className={styles.search} onSubmit={search}>
      <label className="field"><span className="field-label">{t('crmPrivacy.searchLabel')}</span><input className="input" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={100} required /></label>
      <button className="primary-button" type="submit" disabled={loading || query.trim().length < 2}><Icon name="search" size={16} />{t('crmPrivacy.search')}</button>
    </form>
    {loading && <p role="status">{t('common.loading')}</p>}
    {error && <div className="error-state" role="alert">{error}</div>}
    {complete && <div className={styles.success} role="status">{t('crmPrivacy.complete')}</div>}
    {results.length > 0 && <section className={styles.results} aria-label={t('crmPrivacy.matches')}>
      <h2>{t('crmPrivacy.matches')}</h2>
      <ul>{results.map(row => <li key={row.id}>
        <button type="button" aria-pressed={contact?.id === row.id} onClick={() => selectContact(row)}>
          <strong>{row.name}</strong><span>{[row.email, row.phone].filter(Boolean).join(' · ')}</span>
        </button>
      </li>)}</ul>
    </section>}
    {contact && <section className={styles.detail} aria-labelledby="crm-privacy-contact-title">
      <header><div><h2 id="crm-privacy-contact-title">{contact.name}</h2><p>{[contact.email, contact.phone].filter(Boolean).join(' · ')}</p></div><button className="ghost-button small" type="button" onClick={() => { setContact(null); setImpact(null); setShowEraseConfirm(false); setConfirmed(false) }}>{t('common.close')}</button></header>
      {impact && <dl className={styles.impact}>
        <div><dt>{t('crmPrivacy.leads')}</dt><dd>{impact.lead_count}</dd></div>
        <div><dt>{t('crmPrivacy.activities')}</dt><dd>{impact.activity_count}</dd></div>
        <div><dt>{t('crmPrivacy.billingDocuments')}</dt><dd>{impact.billing_document_count || 0}</dd></div>
      </dl>}
      <div className={styles.actions}>
        <button className="ghost-button" type="button" onClick={exportContact} disabled={loading}><Icon name="download" size={16} />{t('crmPrivacy.export')}</button>
        {!showEraseConfirm && <button className="primary-button danger" type="button" onClick={() => { setShowEraseConfirm(true); setConfirmed(false) }} disabled={loading}>{t('crmPrivacy.startAnonymize')}</button>}
      </div>
      {showEraseConfirm && <div className={styles.confirm}>
        <h3>{t('crmPrivacy.confirmTitle')}</h3>
        <p>{t('crmPrivacy.confirmDescription')}</p>
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t('crmPrivacy.confirmCheck')}</label>
        <div className={styles.actions}><button className="ghost-button" type="button" onClick={() => { setShowEraseConfirm(false); setConfirmed(false) }} disabled={loading}>{t('common.cancel')}</button><button className="primary-button danger" type="button" onClick={anonymize} disabled={loading || !confirmed}>{loading ? t('common.loading') : t('crmPrivacy.confirmAction')}</button></div>
      </div>}
    </section>}
    {!loading && results.length === 0 && query.trim().length >= 2 && !error && <p className={styles.empty}>{t('crmPrivacy.noMatches')}</p>}
  </div>
}
