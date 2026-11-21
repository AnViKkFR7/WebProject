import { useLanguage } from '../contexts/LanguageContext'
import Icon from '../components/ui/Icon'
import styles from './AnalyticsIntegrations.module.css'

// Plataformas previstas. Ninguna está conectada todavía: cada vinculación necesita primero
// una aplicación aprobada por la plataforma (ver Features.md · Analítica y vinculaciones).
const INTEGRATIONS = ['googleAnalytics', 'meta', 'googleBusiness', 'appleBusiness']

/** Vinculaciones: qué se podrá ver de cada plataforma y en qué estado está. */
export default function AnalyticsIntegrations() {
  const { t } = useLanguage()
  return (
    <section aria-labelledby="integrations-title">
      <h3 id="integrations-title" className={styles.title}>{t('analyticsHub.integrations.title')}</h3>
      <p className={styles.intro}>{t('analyticsHub.integrations.intro')}</p>
      <ul className={styles.grid}>
        {INTEGRATIONS.map(key => (
          <li key={key} className={`card ${styles.card}`}>
            <div className={styles.head}>
              <h4>{t(`analyticsHub.integrations.${key}.name`)}</h4>
              <span className={`pill ${styles.status}`}>
                <Icon name="clock" size={12} />{t('analyticsHub.integrations.pending')}
              </span>
            </div>
            <p className={styles.what}>{t(`analyticsHub.integrations.${key}.shows`)}</p>
            <p className={styles.need}><strong>{t('analyticsHub.integrations.needs')}</strong> {t(`analyticsHub.integrations.${key}.needs`)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
