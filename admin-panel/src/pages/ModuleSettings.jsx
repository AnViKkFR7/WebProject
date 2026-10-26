import { useCompany } from '../contexts/CompanyContext'
import { useCompanyModules } from '../hooks/useCompanyModules'
import { useFeedback } from '../contexts/FeedbackContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import PageHeader from '../components/ui/PageHeader'
import styles from './ModuleSettings.module.css'

const MODULES = ['items','blog','crm','planning','billing','analytics']

export default function ModuleSettings() {
  const { selectedCompany } = useCompany()
  const { modules, loading, error, refresh, setEnabled } = useCompanyModules()
  const { canManageModules } = usePermissions()
  const { t } = useLanguage()
  const { toast } = useFeedback()

  const toggle = async (module, enabled) => {
    try {
      await setEnabled(module, enabled)
      toast.success(t('modules.saved'))
    } catch { toast.error(t('modules.saveError')) }
  }

  if (!selectedCompany) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>
  if (!canManageModules) return <div className="page-content"><div className="error-state" role="alert">{t('modules.adminOnly')}</div></div>

  return <div className="page-content">
    <PageHeader title={t('modules.title')} description={t('modules.description')} />
    {error && <div className="error-state" role="alert"><span>{t('modules.loadError')}</span><button type="button" onClick={refresh}>{t('feedback.retry')}</button></div>}
    {loading ? <p role="status">{t('common.loading')}</p> : <ul className={styles.list}>
      {MODULES.map(module => <li key={module}>
        <div><strong>{t(`modules.${module}`)}</strong><p>{t(`modules.${module}Description`)}</p></div>
        <label className={styles.toggle}><span>{modules[module] ? t('modules.enabled') : t('modules.disabled')}</span><input type="checkbox" role="switch" checked={Boolean(modules[module])} disabled={loading || error} onChange={event => toggle(module, event.target.checked)} /></label>
      </li>)}
    </ul>}
    <p className={styles.note}>{t('modules.defaultAllEnabled')}</p>
  </div>
}
