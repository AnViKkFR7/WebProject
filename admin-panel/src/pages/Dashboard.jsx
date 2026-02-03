import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'

const Dashboard = () => {
  const { selectedCompany, selectCompany, companies, loading } = useCompany()
  const { t } = useLanguage()

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return { bg: '#fee', color: '#dc2626', label: t('dashboard.admin') }
      case 'editor':
        return { bg: '#eff6ff', color: '#2563eb', label: t('dashboard.editor') }
      case 'viewer':
        return { bg: '#f0fdf4', color: '#16a34a', label: t('dashboard.viewer') }
      default:
        return { bg: '#f3f4f6', color: '#6b7280', label: role }
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-content">
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="page">
        <div className="page-content">
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: '4rem 2rem',
            maxWidth: '600px',
            margin: '2rem auto'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏢</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              {t('dashboard.noCompanies')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              {t('dashboard.noCompaniesDescription')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>{t('dashboard.title')}</h2>
            <p>{t('dashboard.selectCompanyDescription')}</p>
          </div>
        </div>

        {/* Selector de empresa con llamada de atención */}
        <div className="card" style={{ 
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
          border: '2px solid var(--primary-color)',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
            <div style={{ 
              fontSize: '3rem', 
              flexShrink: 0,
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              ⚠️
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 700, 
                marginBottom: '0.5rem',
                color: 'var(--primary-color)'
              }}>
                {t('dashboard.selectCompany')}
              </h3>
              <p style={{ 
                fontSize: '1rem', 
                color: 'var(--text-secondary)', 
                marginBottom: '1.5rem',
                lineHeight: 1.6
              }}>
                {t('dashboard.selectCompanyDescription')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {companies.map(company => {
                  const roleInfo = getRoleBadgeColor(company.userRole)
                  const isSelected = selectedCompany?.id === company.id

                  return (
                    <div
                      key={company.id}
                      onClick={() => selectCompany(company)}
                      style={{
                        padding: '1.25rem',
                        border: isSelected ? '3px solid var(--primary-color)' : '2px solid var(--border-color)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        backgroundColor: isSelected ? 'var(--bg-card)' : 'var(--bg-card)',
                        boxShadow: isSelected ? '0 8px 20px rgba(99, 102, 241, 0.3)' : '0 2px 6px rgba(0,0,0,0.05)',
                        position: 'relative',
                        transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'var(--primary-color)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.2)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'var(--border-color)'
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)'
                        }
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '-10px',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--primary-color)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                        }}>
                          ✓
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: isSelected ? 'var(--primary-color)' : 'var(--primary-light)',
                          color: isSelected ? 'white' : 'var(--primary-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {company.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ 
                            margin: 0, 
                            fontSize: '1.1rem', 
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {company.name}
                          </h4>
                        </div>
                      </div>

                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: roleInfo.bg,
                        color: roleInfo.color
                      }}>
                        {roleInfo.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Información de la empresa seleccionada */}
        {selectedCompany && (
          <div className="card">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              {t('dashboard.workingOn')} {selectedCompany.name}
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {t('dashboard.selectedCompanyDescriptionPrefix')} <strong>{selectedCompany.name}</strong>{t('dashboard.selectedCompanyDescriptionSuffix')} {t('dashboard.selectedCompanyDescriptionHint')}
            </p>
          </div>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.8;
            }
          }
        `}</style>
      </div>
    </div>
  )
}

export default Dashboard
