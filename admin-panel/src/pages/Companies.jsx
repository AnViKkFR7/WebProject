import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getClientCompaniesByCompany, createClientCompany, updateClientCompany,
  deleteClientCompany, getClientCompanyUsage,
} from '../services/clientCompanyService'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { usePermissions } from '../hooks/usePermissions'
import { useCompanyModules } from '../hooks/useCompanyModules'
import { getCompanyColor } from '../lib/planningColors'
import { formatPhoneNumber } from '../lib/phoneUtils'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import ClientCompanyModal from '../components/planning/ClientCompanyModal'
import SlidingIndicator from '../components/ui/SlidingIndicator'
import { emptyPartyForm, filterDirectory, partyToForm, RELATION_FILTERS, FORM_FILTERS } from '../lib/directory'
import '../styles/planning.css'
import styles from './Companies.module.css'


/**
 * Directorio de la empresa seleccionada: clientes (a quienes vende) y colaboradores (con quienes
 * trabaja), cada uno persona física o empresa. Cada tarjeta lleva a su ficha con actividad.
 * No confundir con la empresa del panel, cuyo resumen está en Inicio.
 */
const Companies = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const { toast, confirm } = useFeedback()
  const { canEdit } = usePermissions()
  const { modules } = useCompanyModules()
  const companyId = selectedCompany?.id

  const [companies, setCompanies] = useState([])
  const [state, setState] = useState('loading') // loading | error | ready
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // { editing } | null
  const [form, setForm] = useState(emptyPartyForm)
  const [params, setParams] = useSearchParams()
  const relation = RELATION_FILTERS.includes(params.get('relation')) ? params.get('relation') : 'all'
  const legalForm = FORM_FILTERS.includes(params.get('type')) ? params.get('type') : 'any'
  const setFilter = (key, value, fallback) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value === fallback) next.delete(key); else next.set(key, value)
    return next
  }, { replace: true })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!companyId) return
    setState('loading')
    getClientCompaniesByCompany(companyId)
      .then((data) => { setCompanies(data); setState('ready') })
      .catch((error) => { console.error('Error cargando empresas cliente:', error); setState('error') })
  }, [companyId])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm({ ...emptyPartyForm, is_client: relation !== 'collaborators', is_collaborator: relation === 'collaborators' })
    setFormError('')
    setModal({ editing: null })
  }

  const openEdit = (company) => {
    setForm(partyToForm(company))
    setFormError('')
    setModal({ editing: company })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const payload = { ...form, company_id: companyId }
      if (modal.editing) {
        await updateClientCompany(modal.editing.id, payload)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        await createClientCompany({ ...payload, user_id: user?.id, company_id: companyId })
      }
      setModal(null)
      toast.success(t('companies.saved'))
      load()
    } catch (error) {
      console.error(error)
      setFormError(t('companies.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (company) => {
    let usage = { tasks: 0, bills: 0 }
    try {
      usage = await getClientCompanyUsage(company.id)
    } catch (error) {
      console.error(error)
    }
    const inUse = usage.tasks + usage.bills > 0
    const ok = await confirm({
      title: t('companies.deleteTitle').replace('{name}', company.name),
      message: inUse
        ? t('companies.deleteInUse').replace('{tasks}', usage.tasks).replace('{bills}', usage.bills)
        : t('companies.deleteMessage'),
      confirmLabel: t('companies.archive'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteClientCompany(company.id,companyId)
      toast.success(t('companies.deleted'))
      load()
    } catch (error) {
      console.error(error)
      toast.error(t('feedback.deleteError'))
    }
  }

  if (!selectedCompany) {
    return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>
  }

  const visible = filterDirectory(companies, { search, relation, legalForm })
  const totals = {
    clients: companies.filter(c => c.is_client !== false).length,
    collaborators: companies.filter(c => c.is_collaborator).length,
  }

  const newButton = canEdit && (
    <button type="button" className="primary-button" onClick={openCreate}>
      <Icon name="plus" size={16} />{relation === 'collaborators' ? t('directory.newCollaborator') : t('directory.newClient')}
    </button>
  )
  const relationBadges = company => [
    company.is_client !== false && <span key="client" className={`pill ${styles.client}`}>{t('directory.client')}</span>,
    company.is_collaborator && <span key="collaborator" className={`pill ${styles.collaborator}`}>{t('directory.collaborator')}</span>,
    <span key="form" className={`pill ${styles.neutral}`}>
      <Icon name={company.legal_form === 'individual' ? 'user' : 'companies'} size={12} />
      {t(company.legal_form === 'individual' ? 'directory.individual' : 'directory.company')}
    </span>,
  ]

  return (
    <div className="page-content page-content-wide">
      <PageHeader
        title={t('companies.title')}
        description={t('companies.description')}
        actions={companies.length > 0 && newButton}
      />

      {state === 'loading' && <p className="attr-status">{t('common.loading')}</p>}

      {state === 'error' && (
        <div className="error-state" role="alert">
          <span>{t('errors.loadingCompanies')}</span>
          <button type="button" onClick={load}>{t('feedback.retry')}</button>
        </div>
      )}

      {state === 'ready' && companies.length === 0 && (
        <div className="card">
          <EmptyState
            icon="companies"
            title={t('companies.noClients')}
            description={t('companies.noClientsHint')}
            action={newButton}
          />
        </div>
      )}

      {state === 'ready' && companies.length > 0 && (
        <>
          <p className={styles.counts}>{t('directory.counts').replace('{clients}', totals.clients).replace('{collaborators}', totals.collaborators)}</p>
          <div className={`card ${styles.toolbar}`}>
            <div className={styles.filters}>
              <div className="segmented" role="group" aria-label={t('directory.filterLabel')}>
                <SlidingIndicator activeSelector="[aria-pressed='true']" />
                {RELATION_FILTERS.map(value => (
                  <button key={value} type="button" aria-pressed={relation === value} onClick={() => setFilter('relation', value, 'all')}>
                    {t(`directory.${value}`)}
                  </button>
                ))}
              </div>
              <div className="segmented" role="group" aria-label={t('directory.formFilterLabel')}>
                <SlidingIndicator activeSelector="[aria-pressed='true']" />
                {FORM_FILTERS.map(value => (
                  <button key={value} type="button" aria-pressed={legalForm === value} onClick={() => setFilter('type', value, 'any')}>
                    {t(value === 'any' ? 'directory.anyForm' : `directory.${value}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.search}>
              <label htmlFor="client-search" className="field-label">{t('companies.searchLabel')}</label>
              <input
                id="client-search"
                type="search"
                className="input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('planning.searchPlaceholder')}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            relation === 'collaborators' && totals.collaborators === 0 && !search.trim()
              ? <EmptyState compact icon="users" title={t('directory.noCollaborators')} description={t('directory.noCollaboratorsHint')} action={newButton} />
              : <EmptyState compact icon="search" title={t('directory.noMatches')} />
          ) : (
            <ul className="client-grid">
              {visible.map((company, idx) => {
                const color = getCompanyColor(company, idx)
                return (
                  <li key={company.id} className="client-card" style={{ '--company-color': color }}>
                    <div className="client-card-head">
                      <span className="company-dot" style={{ '--company-color': color }} />
                      <h3 className="client-card-name">
                        <Link to={`/companies/${encodeURIComponent(company.id)}`} className={styles.nameLink}>{company.name}</Link>
                      </h3>
                      {canEdit && (
                        <span className="client-card-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => openEdit(company)}
                            aria-label={t('companies.editNamed').replace('{name}', company.name)}
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => handleDelete(company)}
                            aria-label={t('companies.deleteNamed').replace('{name}', company.name)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </span>
                      )}
                    </div>

                    <div className={styles.badges}>{relationBadges(company)}</div>
                    {company.is_collaborator && company.collaborator_role && <p className={styles.role}>{company.collaborator_role}</p>}

                    <dl className="client-card-fields">
                      {company.legal_form !== 'individual' && (
                        <div className="detail-row">
                          <dt>{t('directory.responsible')}</dt>
                          <dd>{company.responsible || <span className="text-muted">{t('companies.notSet')}</span>}</dd>
                        </div>
                      )}
                      <div className="detail-row">
                        <dt>{t('companies.email')}</dt>
                        <dd>
                          {company.email
                            ? <a href={`mailto:${company.email}`}>{company.email}</a>
                            : <span className="text-muted">{t('companies.notSet')}</span>}
                        </dd>
                      </div>
                      <div className="detail-row">
                        <dt>{t('companies.phone')}</dt>
                        <dd>
                          {company.phone
                            ? <a href={`tel:${company.phone}`}>{formatPhoneNumber(company.phone)}</a>
                            : <span className="text-muted">{t('companies.notSet')}</span>}
                        </dd>
                      </div>
                    </dl>

                    <div className={styles.links}>
                      <Link className="stat-card-cta" to={`/companies/${encodeURIComponent(company.id)}`} aria-label={t('directory.openRecordNamed').replace('{name}', company.name)}>
                        {t('directory.openRecord')}
                        <Icon name="chevronRight" size={14} />
                      </Link>
                      {modules.planning && <Link className="stat-card-cta" to="/planning">
                        {t('companies.seeInPlanning')}
                        <Icon name="chevronRight" size={14} />
                      </Link>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <ClientCompanyModal
        open={Boolean(modal)}
        editing={modal?.editing}
        form={form}
        setForm={setForm}
        error={formError}
        saving={saving}
        onSubmit={handleSubmit}
        onClose={() => setModal(null)}
      />
    </div>
  )
}

export default Companies
