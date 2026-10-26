import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDateTime } from '../lib/dates'
import { slugify } from '../lib/contentSeo'
import { crmService } from '../services/crmService'
import { formatContactTimelineDate, mergeContactTimeline } from '../lib/crmTimeline'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import styles from './Contacts.module.css'

const ACTIVITY_KINDS = ['email', 'call', 'note', 'visit']
const EMPTY_ACTIVITY = { kind: 'note', title: '', details: '' }
const stageLabel = (stage, t) => {
  const key = `crm.stage_${stage.stage_key}`
  const translated = t(key)
  return translated === key ? stage.name : translated
}
const localDateTimeValue = value => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function ContactModal({ contact, stages, members, canEdit, companyId, t, onClose, onSaved, toast }) {
  const [values, setValues] = useState({
    name: contact.name || '', email: contact.email || '', phone: contact.phone || '',
    assigned_to: contact.assigned_to || '', stage_id: contact.stage_id || '',
    next_follow_up_at: localDateTimeValue(contact.next_follow_up_at),
  })
  const [timeline, setTimeline] = useState([])
  const [timelineState, setTimelineState] = useState('loading')
  const [billing, setBilling] = useState({ linked: [], available: [] })
  const [billingState, setBillingState] = useState('loading')
  const [billingChoice, setBillingChoice] = useState('')
  const [activity, setActivity] = useState(EMPTY_ACTIVITY)
  const [saving, setSaving] = useState(false)
  const unifiedTimeline = useMemo(() => mergeContactTimeline(timeline, billing.linked), [timeline, billing.linked])

  useEffect(() => {
    let active = true
    crmService.getContactTimeline(companyId, contact.id)
      .then(rows => { if (active) { setTimeline(rows); setTimelineState('ready') } })
      .catch(() => { if (active) setTimelineState('error') })
    crmService.getContactBilling(companyId, contact.id)
      .then(value => { if (active) { setBilling(value); setBillingState('ready') } })
      .catch(() => { if (active) setBillingState('error') })
    return () => { active = false }
  }, [companyId, contact.id])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = await crmService.updateContact(companyId, contact.id, {
        name: values.name.trim(), email: values.email.trim() || null, phone: values.phone.trim() || null,
        assigned_to: values.assigned_to || null, stage_id: values.stage_id || null,
        next_follow_up_at: values.next_follow_up_at ? new Date(values.next_follow_up_at).toISOString() : null,
      })
      onSaved(saved)
      toast.success(t('crm.contactSaved'))
    } catch { toast.error(t('crm.saveError')) } finally { setSaving(false) }
  }

  const addActivity = async (event) => {
    event.preventDefault()
    if (!activity.title.trim()) return
    setSaving(true)
    try {
      const row = await crmService.addActivity(companyId, contact.id, {
        kind: activity.kind, title: activity.title.trim(), details: activity.details.trim() || null,
      })
      setTimeline(current => [row, ...current])
      setActivity(EMPTY_ACTIVITY)
      toast.success(t('crm.activityAdded'))
    } catch { toast.error(t('crm.saveError')) } finally { setSaving(false) }
  }

  const linkBilling = async (event) => {
    event.preventDefault()
    const [kind, documentId] = billingChoice.split(':')
    if (!kind || !documentId) return
    setSaving(true)
    try {
      await crmService.linkBillingDocument(companyId, contact.id, kind, documentId)
      setBilling(await crmService.getContactBilling(companyId, contact.id))
      setBillingChoice('')
      toast.success(t('crm.billingLinked'))
    } catch { toast.error(t('crm.billingLinkError')) } finally { setSaving(false) }
  }

  const unlinkBilling = async (linkId) => {
    setSaving(true)
    try {
      await crmService.unlinkBillingDocument(companyId, linkId)
      setBilling(await crmService.getContactBilling(companyId, contact.id))
      toast.success(t('crm.billingUnlinked'))
    } catch { toast.error(t('crm.billingLinkError')) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={contact.name} description={contact.email || contact.phone || ''} size="lg">
      <div className={styles.contactDetail}>
        <form className={styles.profileForm} onSubmit={save}>
          <h3>{t('crm.contactData')}</h3>
          <label className="field"><span className="field-label">{t('crm.name')}</span><input className="input" value={values.name} onChange={e => setValues(v => ({ ...v, name: e.target.value }))} required disabled={!canEdit} /></label>
          <label className="field"><span className="field-label">{t('crm.email')}</span><input className="input" type="email" value={values.email} onChange={e => setValues(v => ({ ...v, email: e.target.value }))} disabled={!canEdit} /></label>
          <label className="field"><span className="field-label">{t('crm.phone')}</span><input className="input" type="tel" value={values.phone} onChange={e => setValues(v => ({ ...v, phone: e.target.value }))} disabled={!canEdit} /></label>
          <label className="field"><span className="field-label">{t('crm.stage')}</span><select className="select" value={values.stage_id} onChange={e => setValues(v => ({ ...v, stage_id: e.target.value }))} disabled={!canEdit}><option value="">{t('crm.noStage')}</option>{stages.map(stage => <option key={stage.id} value={stage.id}>{stageLabel(stage,t)}</option>)}</select></label>
          <label className="field"><span className="field-label">{t('crm.assignedTo')}</span><select className="select" value={values.assigned_to} onChange={e => setValues(v => ({ ...v, assigned_to: e.target.value }))} disabled={!canEdit}><option value="">{t('crm.unassigned')}</option>{members.map(member => <option key={member.user_id} value={member.user_id}>{member.full_name || member.user_id.slice(0, 8)}</option>)}</select></label>
          <label className="field"><span className="field-label">{t('crm.nextFollowUp')}</span><input className="input" type="datetime-local" value={values.next_follow_up_at} onChange={e => setValues(v => ({ ...v, next_follow_up_at: e.target.value }))} disabled={!canEdit} /></label>
          {canEdit && <button className="primary-button" type="submit" disabled={saving || !values.name.trim()}>{saving ? t('common.savingChanges') : t('common.save')}</button>}
          {contact.source_path && <p className={styles.source}><strong>{t('crm.source')}:</strong> {contact.source_path}</p>}
          {contact.source_utm_campaign && <p className={styles.source}><strong>{t('crm.campaign')}:</strong> {contact.source_utm_campaign}</p>}
          {contact.consent_given && <p className={styles.consent}><Icon name="check" size={15} />{t('crm.consentRecorded')}{contact.consent_at ? ` · ${formatDateTime(contact.consent_at)}` : ''}</p>}
        </form>

        <section className={styles.timeline} aria-labelledby="crm-timeline-title">
          <h3 id="crm-timeline-title">{t('crm.history')}</h3>
          {canEdit && <form className={styles.activityForm} onSubmit={addActivity}>
            <label className="field"><span className="field-label">{t('crm.activityType')}</span><select className="select" value={activity.kind} onChange={e => setActivity(a => ({ ...a, kind: e.target.value }))}>{ACTIVITY_KINDS.map(kind => <option key={kind} value={kind}>{t(`crm.activity_${kind}`)}</option>)}</select></label>
            <label className="field"><span className="field-label">{t('crm.activityTitle')}</span><input className="input" value={activity.title} onChange={e => setActivity(a => ({ ...a, title: e.target.value }))} maxLength={200} required /></label>
            <label className="field"><span className="field-label">{t('crm.activityDetails')}</span><textarea className="input" rows={2} value={activity.details} onChange={e => setActivity(a => ({ ...a, details: e.target.value }))} maxLength={4000} /></label>
            <button type="submit" className="ghost-button" disabled={saving || !activity.title.trim()}><Icon name="plus" size={15} />{t('crm.addActivity')}</button>
          </form>}
          {timelineState === 'loading' && <p role="status">{t('common.loading')}</p>}
          {timelineState === 'error' && <p role="alert">{t('crm.historyError')}</p>}
          {billingState === 'loading' && <p role="status">{t('common.loading')}</p>}
          {billingState === 'error' && <p role="alert">{t('crm.billingHistoryError')}</p>}
          {timelineState === 'ready' && billingState === 'ready' && unifiedTimeline.length === 0 && <p className={styles.muted}>{t('crm.historyEmpty')}</p>}
          {unifiedTimeline.length > 0 && <ol className={styles.events}>{unifiedTimeline.map(event => <li key={event.id}>
            <span className={styles.eventKind}>{t(`crm.activity_${event.kind}`)}</span>
            <strong>{event.type === 'billing' ? `${t(`crm.activity_${event.kind}`)} · ${event.title}` : event.title}</strong>
            {event.status && <span className={styles.eventStatus}>{event.status}</span>}
            {event.details && <p>{event.details}</p>}
            <time dateTime={event.date}>{formatContactTimelineDate(event.date, formatDateTime)}</time>
            {event.type === 'billing' && canEdit && <button type="button" className="ghost-button small" disabled={saving} aria-label={`${t('crm.unlinkDocument')} ${event.title}`} onClick={() => unlinkBilling(event.linkId)}>{t('crm.unlinkDocument')}</button>}
          </li>)}</ol>}
          {canEdit && billingState === 'ready' && billing.available.length > 0 && <div className={styles.billingActions}>
            <form className={styles.billingLinkForm} onSubmit={linkBilling}>
              <label className="field"><span className="field-label">{t('crm.linkBillingDocument')}</span><select className="select" value={billingChoice} onChange={event => setBillingChoice(event.target.value)}>
                <option value="">{t('crm.chooseBillingDocument')}</option>{billing.available.map(row => <option key={`${row.document_kind}:${row.id}`} value={`${row.document_kind}:${row.id}`}>{row.document_kind === 'invoice' ? t('crm.invoice') : t('crm.quote')} · {row.number} · {row.customer_name || ''}</option>)}
              </select></label><button className="ghost-button" type="submit" disabled={saving || !billingChoice}>{t('crm.linkDocument')}</button>
            </form>
          </div>}
        </section>
      </div>
    </Modal>
  )
}

const Contacts = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const { toast } = useFeedback()
  const { canEdit } = usePermissions()
  const companyId = selectedCompany?.id
  const [board, setBoard] = useState({ stages: [], contacts: [], reviews: [], members: [] })
  const [state, setState] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [followUpsOnly, setFollowUpsOnly] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  const [reviewSelections, setReviewSelections] = useState({})
  const [stageDrafts, setStageDrafts] = useState({})
  const [configOpen, setConfigOpen] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [savingKey, setSavingKey] = useState('')

  useEffect(() => {
    if (!companyId) return undefined
    let active = true
    setState('loading')
    crmService.getBoard(companyId)
      .then(data => { if (active) { setBoard(data); setStageDrafts(Object.fromEntries(data.stages.map(stage => [stage.id, stage.name]))); setState('ready') } })
      .catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [companyId, reloadKey])

  useEffect(() => {
    const contactId = new URLSearchParams(location.search).get('contact')
    if (state !== 'ready' || !contactId) return
    const match = board.contacts.find(contact => contact.id === contactId)
    if (match) setSelectedContact(match)
    navigate('/contacts', { replace: true })
  }, [location.search, state, board.contacts, navigate])

  const needle = search.trim().toLocaleLowerCase()
  const filteredContacts = useMemo(() => board.contacts.filter(contact => (!followUpsOnly || contact.next_follow_up_at) && (!needle ||
    [contact.name, contact.email, contact.phone, contact.source_path, contact.source_utm_campaign]
      .some(value => String(value || '').toLocaleLowerCase().includes(needle)))), [board.contacts, needle, followUpsOnly])

  const saveContact = (saved) => {
    setBoard(current => ({ ...current, contacts: current.contacts.map(contact => contact.id === saved.id ? saved : contact) }))
    setSelectedContact(saved)
  }

  const updateContactField = async (contact, updates) => {
    setSavingKey(contact.id)
    try {
      const saved = await crmService.updateContact(companyId, contact.id, updates)
      saveContact(saved)
      toast.success(t('crm.contactSaved'))
    } catch { toast.error(t('crm.saveError')) } finally { setSavingKey('') }
  }

  const resolveReview = async (lead, createContact) => {
    const contactId = reviewSelections[lead.id]
    if (!createContact && !contactId) return
    setSavingKey(lead.id)
    try {
      await crmService.resolveLead({ companyId, leadId: lead.id, contactId: createContact ? null : contactId, createContact })
      toast.success(t('crm.reviewResolved'))
      setReloadKey(key => key + 1)
    } catch { toast.error(t('crm.reviewError')) } finally { setSavingKey('') }
  }

  const createStage = async (event) => {
    event.preventDefault()
    const name = newStageName.trim()
    const stageKey = slugify(name).replaceAll('-', '_')
    if (!name || !stageKey) return
    setSavingKey('stage')
    try {
      const created = await crmService.createStage(companyId, { name, stage_key: stageKey, position: board.stages.length, is_won: false, is_lost: false })
      setBoard(current => ({ ...current, stages: [...current.stages, created] }))
      setStageDrafts(current => ({ ...current, [created.id]: created.name }))
      setNewStageName('')
      toast.success(t('crm.stageCreated'))
    } catch { toast.error(t('crm.stageError')) } finally { setSavingKey('') }
  }

  const renameStage = async (stage, name) => {
    if (!name.trim() || name.trim() === stage.name) return
    setSavingKey(stage.id)
    try {
      const saved = await crmService.updateStage(companyId, stage.id, { name: name.trim() })
      setBoard(current => ({ ...current, stages: current.stages.map(item => item.id === saved.id ? saved : item) }))
      setStageDrafts(current => ({ ...current, [stage.id]: saved.name }))
      toast.success(t('crm.stageSaved'))
    } catch { toast.error(t('crm.stageError')) } finally { setSavingKey('') }
  }

  const moveStage = async (index, delta) => {
    const next = [...board.stages]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSavingKey('order')
    try {
      for (const [position, stage] of next.entries()) await crmService.updateStage(companyId, stage.id, { position })
      setBoard(current => ({ ...current, stages: next.map((stage, position) => ({ ...stage, position })) }))
    } catch { toast.error(t('crm.stageError')); setReloadKey(key => key + 1) } finally { setSavingKey('') }
  }

  const archiveStage = async (stage) => {
    const hasContacts = board.contacts.some(contact => contact.stage_id === stage.id)
    if (hasContacts) { toast.error(t('crm.stageMustBeEmpty')); return }
    setSavingKey(stage.id)
    try {
      await crmService.updateStage(companyId, stage.id, { is_active: false })
      setBoard(current => ({ ...current, stages: current.stages.filter(item => item.id !== stage.id) }))
      setStageDrafts(current => { const next = { ...current }; delete next[stage.id]; return next })
      toast.success(t('crm.stageArchived'))
    } catch { toast.error(t('crm.stageError')) } finally { setSavingKey('') }
  }

  if (!selectedCompany) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>

  return <div className="page-content page-content-wide">
    <PageHeader title={t('crm.title')} description={t('crm.description')} actions={canEdit && <button className="ghost-button" type="button" aria-expanded={configOpen} onClick={() => setConfigOpen(open => !open)}><Icon name="list" size={16} />{t('crm.configureStages')}</button>} />
    {state === 'loading' && <p role="status">{t('common.loading')}</p>}
    {state === 'error' && <div className="error-state" role="alert"><span>{t('crm.loadError')}</span><button type="button" onClick={() => setReloadKey(key => key + 1)}>{t('feedback.retry')}</button></div>}
    {state === 'ready' && <>
      <div className={styles.toolbar}>
        <label className={styles.search}><span className="sr-only">{t('crm.search')}</span><Icon name="search" size={16} /><input className="input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('crm.search')} /></label>
        <span className={styles.total}>{t('crm.contactsCount').replace('{count}', filteredContacts.length)}</span>
        <label className={styles.followUpFilter}><input type="checkbox" checked={followUpsOnly} onChange={e => setFollowUpsOnly(e.target.checked)} />{t('crm.followUpsOnly')}</label>
      </div>

      {configOpen && canEdit && <section className={styles.stageSettings} aria-labelledby="crm-stage-settings-title">
        <h2 id="crm-stage-settings-title">{t('crm.configureStages')}</h2>
        <ol>{board.stages.map((stage, index) => <li key={stage.id}>
          <label><span className="sr-only">{t('crm.stageName')}</span><input className="input" value={stageDrafts[stage.id] ?? stage.name} onChange={e => setStageDrafts(current => ({ ...current, [stage.id]: e.target.value }))} maxLength={80} /></label>
          <button type="button" className="ghost-button small" disabled={savingKey === stage.id || !(stageDrafts[stage.id] || '').trim() || stageDrafts[stage.id] === stage.name} onClick={() => renameStage(stage, stageDrafts[stage.id])}>{t('common.save')}</button>
          <span className={styles.stageType}>{stage.is_won ? t('crm.wonStage') : stage.is_lost ? t('crm.lostStage') : t('crm.openStage')}</span>
          <button type="button" className="ghost-button small" aria-label={t('crm.moveStageUp')} disabled={index === 0 || savingKey === 'order'} onClick={() => moveStage(index, -1)}><Icon name="chevronUp" size={15} /></button>
          <button type="button" className="ghost-button small" aria-label={t('crm.moveStageDown')} disabled={index === board.stages.length - 1 || savingKey === 'order'} onClick={() => moveStage(index, 1)}><Icon name="chevronDown" size={15} /></button>
          <button type="button" className="ghost-button small" disabled={savingKey === stage.id || board.contacts.some(contact => contact.stage_id === stage.id)} onClick={() => archiveStage(stage)}>{t('crm.archiveStage')}</button>
        </li>)}</ol>
        <form className={styles.newStage} onSubmit={createStage}><label className="field"><span className="field-label">{t('crm.newStage')}</span><input className="input" value={newStageName} onChange={e => setNewStageName(e.target.value)} maxLength={80} /></label><button className="ghost-button" type="submit" disabled={savingKey === 'stage' || !newStageName.trim()}><Icon name="plus" size={15} />{t('crm.addStage')}</button></form>
      </section>}

      {board.reviews.length > 0 && <section className={styles.reviewPanel} aria-labelledby="crm-review-title">
        <div className={styles.reviewHead}><h2 id="crm-review-title">{t('crm.manualReview')}</h2><span>{board.reviews.length}</span></div>
        <p>{t('crm.manualReviewHelp')}</p>
        <ul>{board.reviews.map(lead => <li key={lead.id}>
          <div className={styles.reviewPerson}><strong>{lead.name}</strong><span>{[lead.email, lead.phone].filter(Boolean).join(' · ')}</span><small>{lead.source_path || lead.source_utm_campaign || formatDateTime(lead.created_at)}</small></div>
          <label className={styles.reviewSelect}><span className="sr-only">{t('crm.chooseContact')}</span><select className="select" value={reviewSelections[lead.id] || ''} onChange={e => setReviewSelections(current => ({ ...current, [lead.id]: e.target.value }))}><option value="">{t('crm.chooseContact')}</option>{board.contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name} · {contact.email || contact.phone || t('crm.noContactInfo')}</option>)}</select></label>
          <button type="button" className="primary-button small" disabled={!canEdit || !reviewSelections[lead.id] || savingKey === lead.id} onClick={() => resolveReview(lead, false)}>{t('crm.linkSelected')}</button>
          <button type="button" className="ghost-button small" disabled={!canEdit || savingKey === lead.id} onClick={() => resolveReview(lead, true)}>{t('crm.createNewContact')}</button>
        </li>)}</ul>
      </section>}

      {board.stages.length === 0 ? <div className="card"><EmptyState icon="users" title={t('crm.noStages')} description={t('crm.noStagesHint')} /></div> : <div className={styles.board} aria-label={t('crm.pipeline')}>
        {board.stages.map(stage => {
          const contacts = filteredContacts.filter(contact => contact.stage_id === stage.id)
          return <section className={styles.column} key={stage.id} aria-labelledby={`crm-column-${stage.id}`}>
            <header><h2 id={`crm-column-${stage.id}`}>{stageLabel(stage,t)}</h2><span>{contacts.length}</span></header>
            {contacts.length === 0 ? <p className={styles.columnEmpty}>{t('crm.noContactsInStage')}</p> : <ul>{contacts.map(contact => <li key={contact.id} className={styles.card}>
              <button className={styles.cardOpen} type="button" onClick={() => setSelectedContact(contact)}><strong>{contact.name}</strong><span>{contact.email || contact.phone || t('crm.noContactInfo')}</span>{contact.source_path && <small>{contact.source_path}</small>}{contact.source_utm_campaign && <small>{t('crm.campaign')}: {contact.source_utm_campaign}</small>}{contact.next_follow_up_at && <small className={new Date(contact.next_follow_up_at) < new Date() ? styles.followUpOverdue : styles.followUpDue}>{new Date(contact.next_follow_up_at) < new Date() ? t('crm.followUpOverdue') : t('crm.nextFollowUp')}: {formatDateTime(contact.next_follow_up_at)}</small>}</button>
              {canEdit && <div className={styles.cardControls}>
                <label><span className="sr-only">{t('crm.moveContact').replace('{name}', contact.name)}</span><select className="select" value={contact.stage_id || ''} disabled={savingKey === contact.id} onChange={e => updateContactField(contact, { stage_id: e.target.value || null })}>{board.stages.map(item => <option key={item.id} value={item.id}>{stageLabel(item,t)}</option>)}</select></label>
                <label><span className="sr-only">{t('crm.assignContact').replace('{name}', contact.name)}</span><select className="select" value={contact.assigned_to || ''} disabled={savingKey === contact.id} onChange={e => updateContactField(contact, { assigned_to: e.target.value || null })}><option value="">{t('crm.unassigned')}</option>{board.members.map(member => <option key={member.user_id} value={member.user_id}>{member.full_name || member.user_id.slice(0, 8)}</option>)}</select></label>
              </div>}
            </li>)}</ul>}
          </section>
        })}
      </div>}
      {board.contacts.length === 0 && board.reviews.length === 0 && <div className="card"><EmptyState icon="users" title={t('crm.empty')} description={t('crm.emptyHint')} /></div>}
    </>}
    {selectedContact && <ContactModal key={selectedContact.id} contact={selectedContact} stages={board.stages} members={board.members} canEdit={canEdit} companyId={companyId} t={t} toast={toast} onClose={() => setSelectedContact(null)} onSaved={saveContact} />}
  </div>
}

export default Contacts
