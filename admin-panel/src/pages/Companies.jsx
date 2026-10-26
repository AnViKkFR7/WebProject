import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getClientCompaniesByCompany, createClientCompany, updateClientCompany,
  deleteClientCompany, getClientCompanyUsage,
} from '../services/clientCompanyService'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { usePermissions } from '../hooks/usePermissions'
import { getCompanyColor } from '../lib/planningColors'
import { formatPhoneNumber } from '../lib/phoneUtils'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import ClientCompanyModal from '../components/planning/ClientCompanyModal'
import '../styles/planning.css'

const emptyForm = { name: '', tax_id:'', billing_address:'', phone: '', email: '', responsible: '', color: '#1976d2' }

/**
 * Empresas cliente de la empresa seleccionada: las que se planifican y
 * facturan en Planning. No confundir con la empresa del panel, cuyo resumen
 * está en el Dashboard.
 */
const Companies = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const { toast, confirm } = useFeedback()
  const { canEdit } = usePermissions()
  const companyId = selectedCompany?.id

  const [companies, setCompanies] = useState([])
  const [state, setState] = useState('loading') // loading | error | ready
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // { editing } | null
  const [form, setForm] = useState(emptyForm)
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
    setForm(emptyForm)
    setFormError('')
    setModal({ editing: null })
  }

  const openEdit = (company) => {
    setForm({
      name: company.name || '',
      tax_id:company.tax_id || '',
      billing_address:company.billing_address || '',
      phone: company.phone || '',
      email: company.email || '',
      responsible: company.responsible || '',
      color: company.color || '#1976d2',
    })
    setFormError('')
    setModal({ editing: company })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        tax_id:form.tax_id.trim() || null,
        billing_address:form.billing_address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        responsible: form.responsible.trim() || null,
        color: form.color,
        company_id:companyId,
      }
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

  const visible = companies.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()))

  const newButton = canEdit && (
    <button type="button" className="primary-button" onClick={openCreate}>
      <Icon name="plus" size={16} />{t('companies.newClient')}
    </button>
  )

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
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="client-search" className="field-label">{t('companies.searchLabel')}</label>
            <input
              id="client-search"
              type="search"
              className="input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('planning.searchPlaceholder')}
              style={{ maxWidth: 400 }}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState compact icon="search" title={t('companies.noMatches')} />
          ) : (
            <ul className="client-grid">
              {visible.map((company, idx) => {
                const color = getCompanyColor(company, idx)
                return (
                  <li key={company.id} className="client-card" style={{ '--company-color': color }}>
                    <div className="client-card-head">
                      <span className="company-dot" style={{ '--company-color': color }} />
                      <h3 className="client-card-name">{company.name}</h3>
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

                    <dl className="client-card-fields">
                      <div className="detail-row">
                        <dt>{t('companies.responsible')}</dt>
                        <dd>{company.responsible || <span className="text-muted">{t('companies.notSet')}</span>}</dd>
                      </div>
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

                    <Link className="stat-card-cta" to="/planning">
                      {t('companies.seeInPlanning')}
                      <Icon name="chevronRight" size={14} />
                    </Link>
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
