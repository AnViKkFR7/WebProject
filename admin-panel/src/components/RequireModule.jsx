import { useCompanyModules } from '../hooks/useCompanyModules'
import { useLanguage } from '../contexts/LanguageContext'

export default function RequireModule({ module, children }) {
  const { modules, loading, error, refresh } = useCompanyModules()
  const { t } = useLanguage()
  if (loading) return <div className="page-content"><p role="status">{t('common.loading')}</p></div>
  if (error) return <div className="page-content"><div className="error-state" role="alert"><span>{t('modules.loadError')}</span><button type="button" onClick={refresh}>{t('feedback.retry')}</button></div></div>
  if (!modules[module]) return <div className="page-content"><section className="card"><h1>{t('modules.disabledTitle')}</h1><p>{t('modules.disabledDescription')}</p></section></div>
  return children
}
