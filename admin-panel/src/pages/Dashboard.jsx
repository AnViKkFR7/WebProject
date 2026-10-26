import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { fetchCompanyOverview,fetchRecentQuoteApprovalResponses } from '../services/companyOverviewService'
import { formatDateTime } from '../lib/dates'
import { ITEM_STATUSES, MEMBER_ROLES } from '../lib/companyOverview'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import StatCard from '../components/dashboard/StatCard'
import StatBreakdown from '../components/dashboard/StatBreakdown'
import styles from './Dashboard.module.css'

const STATUS_TONE = {
  draft: 'var(--text-tertiary)',
  published: 'var(--success-color)',
  archived: 'var(--danger-color)',
}

const ROLE_TONE = {
  admin: 'var(--primary-color)',
  editor: 'var(--success-color)',
  viewer: 'var(--text-tertiary)',
}

const money = (amount) => `${Number(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const Dashboard = () => {
  const { selectedCompany, companies, loading: companiesLoading, error: companiesError, reload } = useCompany()
  const { t } = useLanguage()
  const { canSeeAdministration } = usePermissions()

  const [overview, setOverview] = useState(null)
  const [state, setState] = useState('loading') // loading | error | ready
  const [reloadKey, setReloadKey] = useState(0)
  const companyId = selectedCompany?.id

  useEffect(() => {
    if (!companyId) return undefined
    let cancelled = false
    fetchCompanyOverview(companyId)
      .then((data) => { if (!cancelled) { setOverview(data); setState('ready') } })
      .catch((error) => {
        console.error('Error cargando el resumen:', error)
        if (!cancelled) setState('error')
      })
    return () => { cancelled = true }
  }, [companyId, reloadKey])

  useEffect(()=>{
    if(!companyId)return undefined
    let active=true
    const refresh=async()=>{
      try{const quoteApprovals=await fetchRecentQuoteApprovalResponses(companyId);if(active)setOverview(previous=>previous?{...previous,quoteApprovals}:previous)}catch{return}
    }
    const timer=window.setInterval(()=>void refresh(),30000)
    return()=>{active=false;window.clearInterval(timer)}
  },[companyId])

  const retry = () => { setState('loading'); setReloadKey(k => k + 1) }

  if (companiesLoading) {
    return <div className="page-content"><p>{t('common.loading')}</p></div>
  }

  // Un fallo de red o de permisos no es "no tienes empresas"
  if (companiesError) {
    return (
      <div className="page-content">
        <div className="error-state" role="alert">
          <span>{t('feedback.companiesLoadError')}</span>
          <button type="button" onClick={reload}>{t('feedback.retry')}</button>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="page-content">
        <div className="card">
          <EmptyState
            icon="companies"
            title={t('dashboard.noCompanies')}
            description={t('dashboard.noCompaniesDescription')}
          />
        </div>
      </div>
    )
  }

  const roleLabel = selectedCompany?.userRole ? t(`dashboard.${selectedCompany.userRole}`) : null

  return (
    <div className="page-content page-content-wide">
      <PageHeader
        title={selectedCompany?.name || t('nav.dashboard')}
        description={t('dashboard.overviewDescription')}
      >
        {roleLabel && <p className="dashboard-role">{t('dashboard.yourRole')}: <strong>{roleLabel}</strong></p>}
      </PageHeader>

      {state === 'loading' && <p className="attr-status">{t('common.loading')}</p>}

      {state === 'error' && (
        <div className="error-state" role="alert">
          <span>{t('dashboard.overviewError')}</span>
          <button type="button" onClick={retry}>{t('feedback.retry')}</button>
        </div>
      )}

      {state === 'ready' && overview && (
        <>
        {overview.quoteApprovals?.length>0 && <section className={styles.approvals} aria-labelledby="dashboard-approvals-title">
          <header><div><h2 id="dashboard-approvals-title">{t('dashboard.approvalsTitle')}</h2><p>{t('dashboard.approvalsHelp')}</p></div><Icon name="file" size={20}/></header>
          <ul>{overview.quoteApprovals.map(response=><li key={`${response.quote_id}-${response.responded_at}`}>
            <span className={styles.decision} data-decision={response.decision}>{t(`quotes.${response.decision}`)}</span>
            <div><strong>{response.customer_name}</strong><span>{t('dashboard.approvalQuote').replace('{number}',response.quote_number)} · {formatDateTime(response.responded_at)}</span></div>
            <Link to={`/quotes/${encodeURIComponent(response.quote_id)}`} title={t('dashboard.openApprovalQuote')}>{t('dashboard.openApprovalQuote')}</Link>
          </li>)}</ul>
        </section>}
        <div className="stat-grid">
          <StatCard
            icon="items"
            title={t('nav.items')}
            value={overview.items.total}
            hint={t('dashboard.itemsHint')}
            to="/items"
            ctaLabel={t('dashboard.goToItems')}
          >
            <StatBreakdown
              total={overview.items.total}
              rows={ITEM_STATUSES.map(status => ({
                key: status,
                label: t(`items.${status}`),
                value: overview.items.byStatus[status],
                tone: STATUS_TONE[status],
              }))}
            />
          </StatCard>

          <StatCard
            icon="data"
            title={t('nav.myData')}
            value={overview.content.itemTypes}
            hint={t('dashboard.typesHint').replace('{count}', overview.content.attributes)}
            to="/my-data"
            ctaLabel={t('dashboard.goToAttributes')}
          />

          <StatCard
            icon="mail"
            title={t('leads.title')}
            value={overview.leads.new}
            hint={t('dashboard.leadsHint')}
            to={overview.leads.new > 0 ? '/leads?status=new' : '/leads'}
            ctaLabel={t('dashboard.goToLeads')}
          >
            <p className="stat-card-extra">
              {t('dashboard.leadsTotal').replace('{count}', overview.leads.total)}
            </p>
          </StatCard>

          <StatCard
            icon="planning"
            title={t('nav.planning')}
            value={overview.planning.upcoming}
            hint={t('dashboard.planningHint')}
            to="/planning"
            ctaLabel={t('dashboard.goToPlanning')}
          >
            {overview.planning.next.length > 0 ? (
              <ul className="mini-list">
                {overview.planning.next.map(task => (
                  <li key={task.id}>
                    <span className="mini-list-title">{task.title}</span>
                    <span className="mini-list-meta">{formatDateTime(task.start_datetime)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="stat-card-empty">{t('dashboard.noUpcoming')}</p>
            )}
          </StatCard>

          <StatCard
            icon="analytics"
            title={t('nav.analytics')}
            value={overview.analytics?.available ? overview.analytics.visitors : '—'}
            hint={overview.analytics?.available
              ? t('dashboard.analyticsHint').replace('{days}', overview.analytics.days)
              : t('dashboard.analyticsEmpty')}
            to="/analytics"
            ctaLabel={t('dashboard.goToAnalytics')}
          >
            {overview.analytics?.available && (
              <p className="stat-card-extra">
                {t('dashboard.pageViews')}: <strong>{overview.analytics.pageViews.toLocaleString('es-ES')}</strong>
              </p>
            )}
          </StatCard>

          <StatCard
            icon="companies"
            title={t('dashboard.clientCompanies')}
            value={overview.clients}
            hint={t('dashboard.clientsHint')}
            to="/companies"
            ctaLabel={t('dashboard.goToCompanies')}
          >
            <p className="stat-card-extra">
              <span className="bill-total-income">+{money(overview.planning.toReceive)}</span>
              {' · '}
              <span className="bill-total-expense">−{money(overview.planning.toPay)}</span>
            </p>
          </StatCard>

          {canSeeAdministration && (
            <StatCard
              icon="users"
              title={t('nav.users')}
              value={overview.people.total}
              hint={t('dashboard.usersHint')}
              to="/users"
              ctaLabel={t('dashboard.goToUsers')}
            >
              <StatBreakdown
                total={overview.people.total}
                rows={MEMBER_ROLES.map(role => ({
                  key: role,
                  label: t(`dashboard.${role}`),
                  value: overview.people.byRole[role],
                  tone: ROLE_TONE[role],
                }))}
              />
            </StatCard>
          )}
        </div>
        </>
      )}

      {companies.length > 1 && (
        <p className="dashboard-switch-hint">
          <Icon name="info" size={14} />
          {t('dashboard.switchHint')}
        </p>
      )}
    </div>
  )
}

export default Dashboard
