import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useCompany } from '../contexts/CompanyContext'
import { usePermissions } from '../hooks/usePermissions'
import { useCompanyModules } from '../hooks/useCompanyModules'
import { companySettingsTabs } from '../lib/companySettings'
import PageHeader from '../components/ui/PageHeader'
import SlidingIndicator from '../components/ui/SlidingIndicator'
import styles from './CompanySettings.module.css'

/**
 * «Ajustes de empresa»: reúne en pestañas lo que antes estaba repartido entre Mi cuenta y
 * Administración. Las URLs de cada pestaña se mantienen (/settings/modules, /emails, /privacy).
 */
export default function CompanySettings() {
  const { t } = useLanguage()
  const { selectedCompany } = useCompany()
  const permissions = usePermissions()
  const { modules, loading } = useCompanyModules()
  const { pathname } = useLocation()
  const tabs = companySettingsTabs(permissions, loading ? {} : modules)

  if (!selectedCompany) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>
  if (!tabs.length) return <div className="page-content"><div className="error-state" role="alert">{t('companySettings.forbidden')}</div></div>
  if (pathname.replace(/\/+$/, '') === '/settings') return <Navigate to={`/settings/${tabs[0].path}`} replace />

  return (
    <div className="page-content">
      <PageHeader title={t('companySettings.title')} description={t('companySettings.description').replace('{company}', selectedCompany.name)} />
      <nav className={styles.tabs} aria-label={t('companySettings.tabsLabel')}>
        <SlidingIndicator activeSelector={`.${styles.active}`} itemSelector={`.${styles.tab}`} />
        {tabs.map(tab => (
          <NavLink key={tab.path} to={`/settings/${tab.path}`} className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.active}` : ''}`}>
            {t(`companySettings.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      <div className={styles.panel}><Outlet /></div>
    </div>
  )
}
