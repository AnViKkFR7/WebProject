import { useState, useEffect } from 'react'
import { companyService } from '../../services/companyService'
import { useLanguage } from '../../contexts/LanguageContext'

const PersonalTab = ({ selectedCompany, currentUser }) => {
  const { t } = useLanguage()
  const [personalFormData, setPersonalFormData] = useState({
    full_name: '',
    phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (selectedCompany?.id) {
      loadMemberProfile()
    }
  }, [selectedCompany])

  const loadMemberProfile = async () => {
    try {
      const profile = await companyService.getCurrentUserMemberProfile(selectedCompany.id)
      setPersonalFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      })
    } catch (error) {
      console.error('Error cargando perfil del miembro:', error)
    }
  }

  const handleSavePersonalInfo = async (e) => {
    e.preventDefault()
    if (!selectedCompany?.id) {
      setErrorMessage(t('profile.messages.noCompanySelected'))
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await companyService.updateCurrentUserMemberProfile(selectedCompany.id, personalFormData)
      setSuccessMessage(t('profile.messages.profileUpdated'))
      await loadMemberProfile()
    } catch (error) {
      setErrorMessage(error.message || t('profile.messages.profileUpdateError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tab-content animated-card">
      <div className="card-header">
        <h3>{t('profile.personal.title')}</h3>
        <p>{t('profile.personal.description')}</p>
      </div>

      {!selectedCompany && (
        <div className="info-banner" style={{ marginBottom: '1rem' }}>
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

      {successMessage && (
        <div style={{
          background: '#d1f4e0',
          border: '1px solid #4caf50',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          color: '#1b5e20',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{
          background: '#ffeaea',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          color: '#b71c1c',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSavePersonalInfo}>
        <div className="form-grid">
          <label className="form-group full-width">
            <span>{t('profile.personal.fullName')}</span>
            <input
              type="text"
              className="input"
              value={personalFormData.full_name}
              onChange={(e) => setPersonalFormData({ ...personalFormData, full_name: e.target.value })}
              required
            />
          </label>
          <label className="form-group">
            <span>{t('profile.personal.email')}</span>
            <input
              type="email"
              className="input"
              value={currentUser?.email || ''}
              disabled
            />
            <small style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {t('profile.personal.emailReadOnly')}
            </small>
          </label>
          <label className="form-group">
            <span>{t('profile.personal.phone')}</span>
            <input
              type="tel"
              className="input"
              value={personalFormData.phone}
              onChange={(e) => setPersonalFormData({ ...personalFormData, phone: e.target.value })}
            />
          </label>
        </div>

        <div className="card-footer" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
          <button
            type="submit"
            className="primary-button"
            disabled={loading || !selectedCompany}
          >
            {loading ? t('profile.personal.saving') : t('profile.personal.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PersonalTab
