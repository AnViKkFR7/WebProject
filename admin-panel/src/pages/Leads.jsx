import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { usePermissions } from '../hooks/usePermissions'
import { leadService } from '../services/leadService'
import { ageLabel, countByStatus, filterLeads, isStale, LEAD_STATUSES, NEXT_STATUS } from '../lib/leads'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import LeadDetailModal from '../components/leads/LeadDetailModal'

const FILTERS = ['all', ...LEAD_STATUSES]

const Leads = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const { toast, confirm } = useFeedback()
  const { canEdit } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const companyId = selectedCompany?.id

  const [leads, setLeads] = useState([])
  const [state, setState] = useState('loading') // loading | error | ready
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  const status = FILTERS.includes(searchParams.get('status')) ? searchParams.get('status') : 'all'

  useEffect(() => {
    if (!companyId) return undefined
    let cancelled = false
    leadService.getLeads(companyId)
      .then((data) => { if (!cancelled) { setLeads(data); setState('ready') } })
      .catch((error) => {
        console.error('Error cargando solicitudes:', error)
        if (!cancelled) setState('error')
      })
    return () => { cancelled = true }
  }, [companyId, reloadKey])

  const retry = () => { setState('loading'); setReloadKey(k => k + 1) }
  const setStatusFilter = (value) => setSearchParams(value === 'all' ? {} : { status: value })

  const counts = useMemo(() => countByStatus(leads), [leads])
  const visible = useMemo(() => filterLeads(leads, { status, query }), [leads, status, query])

  const applyUpdate = async (id, updates) => {
    setSaving(true)
    try {
      const updated = await leadService.updateLead(id, updates)
      setLeads(prev => prev.map(lead => (lead.id === id ? updated : lead)))
      setSelected(null)
      toast.success(t('leads.saved'))
    } catch (error) {
      console.error(error)
      toast.error(t('leads.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const advance = async (lead) => {
    const next = NEXT_STATUS[lead.status]
    if (!next) return
    try {
      const updated = await leadService.updateLead(lead.id, { status: next })
      setLeads(prev => prev.map(item => (item.id === lead.id ? updated : item)))
      toast.success(t('leads.movedTo').replace('{status}', t(`leads.status_${next}`)))
    } catch (error) {
      console.error(error)
      toast.error(t('leads.saveError'))
    }
  }

  const handleDelete = async (lead) => {
    const ok = await confirm({
      title: t('leads.deleteTitle').replace('{name}', lead.name),
      message: t('leads.deleteMessage'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    try {
      await leadService.deleteLead(lead.id)
      setLeads(prev => prev.filter(item => item.id !== lead.id))
      setSelected(null)
      toast.success(t('leads.deleted'))
    } catch (error) {
      console.error(error)
      toast.error(t('feedback.deleteError'))
    }
  }

  if (!selectedCompany) {
    return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>
  }

  return (
    <div className="page-content page-content-wide">
      <PageHeader title={t('leads.title')} description={t('leads.description')} />

      {state === 'loading' && <p className="attr-status">{t('common.loading')}</p>}

      {state === 'error' && (
        <div className="error-state" role="alert">
          <span>{t('leads.loadError')}</span>
          <button type="button" onClick={retry}>{t('feedback.retry')}</button>
        </div>
      )}

      {state === 'ready' && counts.total === 0 && (
        <div className="card">
          <EmptyState
            icon="mail"
            title={t('leads.empty')}
            description={t('leads.emptyHint')}
          />
        </div>
      )}

      {state === 'ready' && counts.total > 0 && (
        <>
          <div className="lead-toolbar">
            <div className="segmented" role="group" aria-label={t('leads.filterByStatus')}>
              {FILTERS.map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={status === value}
                  style={{ width: 'auto', padding: '0 0.875rem', fontSize: '0.8rem' }}
                >
                  {value === 'all' ? t('leads.filterAll') : t(`leads.status_${value}`)}
                  <span className="lead-count">{value === 'all' ? counts.total : counts[value]}</span>
                </button>
              ))}
            </div>

            <input
              type="search"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('leads.searchPlaceholder')}
              aria-label={t('leads.searchPlaceholder')}
              style={{ maxWidth: 320 }}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState compact icon="search" title={t('leads.noMatches')} />
          ) : (
            <ul className="lead-list">
              {visible.map(lead => (
                <li key={lead.id} className={`lead-row is-${lead.status}${isStale(lead) ? ' is-stale' : ''}`}>
                  <button type="button" className="lead-open stretched-link" onClick={() => setSelected(lead)}>
                    <span className="lead-name">{lead.name}</span>
                    <span className="lead-preview">{lead.message || lead.email || lead.phone}</span>
                  </button>

                  <span className={`pill lead-pill-${lead.status}`}>{t(`leads.status_${lead.status}`)}</span>
                  <span className="lead-age">{ageLabel(lead.created_at, t)}</span>

                  {canEdit && NEXT_STATUS[lead.status] && (
                    <button
                      type="button"
                      className="ghost-button small row-action"
                      onClick={() => advance(lead)}
                    >
                      <Icon name="check" size={14} />
                      {t(`leads.markAs_${NEXT_STATUS[lead.status]}`)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected && (
        <LeadDetailModal
          key={selected.id}
          lead={selected}
          canEdit={canEdit}
          saving={saving}
          onSave={applyUpdate}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

export default Leads
