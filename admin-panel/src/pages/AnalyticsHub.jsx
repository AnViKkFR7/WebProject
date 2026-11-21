import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useCompany } from '../contexts/CompanyContext'
import PageHeader from '../components/ui/PageHeader'
import SlidingIndicator from '../components/ui/SlidingIndicator'
import styles from './CompanySettings.module.css'

// Mismas pestañas que «Ajustes de empresa»: cada una tiene su propia URL.
const TABS = [
  { path: 'web', key: 'web' },
  { path: 'integrations', key: 'integrations' },
]

/** «Analítica»: tráfico de las webs propias y vinculaciones con plataformas externas. */
export default function AnalyticsHub() {
  const { t } = useLanguage()
  const { selectedCompany } = useCompany()
  const { pathname } = useLocation()

  if (!selectedCompany) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>
  if (pathname.replace(/\/+$/, '') === '/analytics') return <Navigate to="/analytics/web" replace />

  return (
    <div className="page-content">
      <PageHeader title={t('analytics.title')} description={t('analyticsHub.description').replace('{company}', selectedCompany.name)} />
      <nav className={styles.tabs} aria-label={t('analyticsHub.tabsLabel')}>
        <SlidingIndicator activeSelector={`.${styles.active}`} itemSelector={`.${styles.tab}`} />
        {TABS.map(tab => (
          <NavLink key={tab.path} to={`/analytics/${tab.path}`} className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.active}` : ''}`}>
            {t(`analyticsHub.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <div className={styles.panel}><Outlet /></div>
    </div>
  )
}
