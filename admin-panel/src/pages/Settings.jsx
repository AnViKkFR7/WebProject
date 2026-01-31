import { useLanguage } from '../contexts/LanguageContext'

const Settings = () => {
  const { t } = useLanguage()
  
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>{t('settings.title')}</h2>
          <p>{t('settings.description')}</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">{t('settings.saveChanges')}</button>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>{t('settings.profileSection')}</h3>
          <div className="form-grid">
            <label>
              {t('settings.name')}
              <input className="input" defaultValue="Joselyn Mejía" />
            </label>
            <label>
              {t('settings.email')}
              <input className="input" defaultValue="joselyn@email.com" />
            </label>
            <label>
              {t('settings.phone')}
              <input className="input" defaultValue="+34 600 000 000" />
            </label>
          </div>
        </div>
        <div className="card">
          <h3>{t('settings.supabaseSection')}</h3>
          <div className="form-grid">
            <label>
              {t('settings.project')}
              <input className="input" defaultValue="regiamare-prod" />
            </label>
            <label>
              {t('settings.url')}
              <input className="input" defaultValue="https://xxxx.supabase.co" />
            </label>
            <label>
              {t('settings.publicKey')}
              <input className="input" defaultValue="public-anon-key" />
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Settings
