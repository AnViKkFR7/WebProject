import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext'

const CompanyTab = ({ selectedCompany, memberProfile }) => {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="tab-content animated-card">
      <div className="card-header">
        <h3>{t('profile.company.title')}</h3>
        <p>{t('profile.company.description')}</p>
      </div>

      {!selectedCompany && (
        <div className="info-banner">
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'left', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex' }}>
              <span className="icon">⚠️</span>
            </div>
            <div style={{ display: 'flex', paddingLeft: '1rem', height: 'fit-content' }}>
              <p style={{ margin: '0' }}>{t('profile.messages.noCompanySelected')}</p>
            </div>
          </div>
        </div>
      )}

      {selectedCompany && (
        <>
          <div className="info-banner">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
                <span className="icon">🏢</span>
                <div>
                  <h4 style={{ margin: 0 }}>{selectedCompany.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {t('profile.company.yourRole')}: <strong>{memberProfile?.role === 'admin' ? t('dashboard.admin') : memberProfile?.role === 'editor' ? t('dashboard.editor') : t('dashboard.viewer')}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-info">
                <h4>{t('profile.company.manageCompanyTitle')}</h4>
                <p>{t('profile.company.manageCompanyDescription')}</p>
              </div>
              <button
                className="primary-button"
                onClick={() => navigate('/companies')}
              >
                {t('profile.company.goToCompanies')}
              </button>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h4>{t('profile.company.manageUsersTitle')}</h4>
                <p>{t('profile.company.manageUsersDescription')}</p>
              </div>
              <button
                className="primary-button"
                onClick={() => navigate('/users')}
              >
                {t('profile.company.goToUsers')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CompanyTab
