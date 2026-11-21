import { Link } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useCompanyModules } from '../../hooks/useCompanyModules'
import Icon from '../ui/Icon'
import styles from './CompanyGeneralSettings.module.css'

/** Resumen de la empresa y accesos a lo que se configura en otras secciones. */
export default function CompanyGeneralSettings() {
  const { t } = useLanguage()
  const { selectedCompany } = useCompany()
  const { modules } = useCompanyModules()
  if (!selectedCompany) return null

  const links = [
    { to: '/users', icon: 'users', key: 'team' },
    modules.billing !== false && { to: '/invoicing', icon: 'invoice', key: 'billing' },
  ].filter(Boolean)

  return (
    <section className={styles.wrapper} aria-labelledby="company-general-title">
      <div className={`card ${styles.summary}`}>
        <span className={styles.icon} aria-hidden="true"><Icon name="companies" size={22} /></span>
        <div>
          <h3 id="company-general-title">{selectedCompany.name}</h3>
          {selectedCompany.userRole && (
            <p>{t('dashboard.yourRole')}: <strong>{t(`dashboard.${selectedCompany.userRole}`)}</strong></p>
          )}
        </div>
      </div>

      <ul className={styles.links}>
        {links.map(link => (
          <li key={link.key} className="card">
            <Icon name={link.icon} size={18} />
            <div>
              <h4>{t(`companySettings.general.${link.key}Title`)}</h4>
              <p>{t(`companySettings.general.${link.key}Help`)}</p>
            </div>
            <Link className="ghost-button small" to={link.to}>{t(`companySettings.general.${link.key}Action`)}</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
