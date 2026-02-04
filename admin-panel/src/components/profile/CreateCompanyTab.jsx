import { useState } from 'react'
import { companyService } from '../../services/companyService'
import { useLanguage } from '../../contexts/LanguageContext'

const CreateCompanyTab = ({ onCompanyCreated }) => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [newCompany, setNewCompany] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    description: '',
    website_url: '',
    logo_url: ''
  })

  const handleCreateCompany = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await companyService.createCompany(newCompany)
      setSuccessMessage(`${t('profile.messages.companyCreatedPrefix')}${newCompany.name}${t('profile.messages.companyCreatedSuffix')}`)
      setNewCompany({
        name: '',
        contact_email: '',
        contact_phone: '',
        description: '',
        website_url: '',
        logo_url: ''
      })
      if (onCompanyCreated) {
        await onCompanyCreated()
      }
    } catch (error) {
      setErrorMessage(error.message || t('profile.messages.companyCreateError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tab-content animated-card">
      <div className="card-header">
        <h3>{t('profile.createCompany.title')}</h3>
        <p>{t('profile.createCompany.description')}</p>
      </div>

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

      <form onSubmit={handleCreateCompany}>
        <div className="form-grid">
          <label className="form-group full-width">
            <span>{t('profile.createCompany.companyName')}</span>
            <input
              type="text"
              className="input"
              value={newCompany.name}
              onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
              required
            />
          </label>

          <label className="form-group">
            <span>{t('profile.createCompany.contactEmail')}</span>
            <input
              type="email"
              className="input"
              value={newCompany.contact_email}
              onChange={(e) => setNewCompany({ ...newCompany, contact_email: e.target.value })}
              required
            />
          </label>

          <label className="form-group">
            <span>{t('profile.createCompany.contactPhone')}</span>
            <input
              type="tel"
              className="input"
              value={newCompany.contact_phone}
              onChange={(e) => setNewCompany({ ...newCompany, contact_phone: e.target.value })}
              required
            />
          </label>

          <label className="form-group full-width">
            <span>{t('profile.createCompany.descriptionLabel')}</span>
            <textarea
              className="input"
              rows="4"
              value={newCompany.description}
              onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
            ></textarea>
          </label>

          <label className="form-group">
            <span>{t('profile.createCompany.website')}</span>
            <input
              type="url"
              className="input"
              placeholder={t('profile.createCompany.websitePlaceholder')}
              value={newCompany.website_url}
              onChange={(e) => setNewCompany({ ...newCompany, website_url: e.target.value })}
            />
          </label>

          <label className="form-group">
            <span>{t('profile.createCompany.logoUrl')}</span>
            <input
              type="url"
              className="input"
              placeholder={t('profile.createCompany.logoUrlPlaceholder')}
              value={newCompany.logo_url}
              onChange={(e) => setNewCompany({ ...newCompany, logo_url: e.target.value })}
            />
          </label>
        </div>

        <div className="card-footer" style={{ paddingTop: '1rem' }}>
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? t('profile.createCompany.creating') : t('profile.createCompany.create')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateCompanyTab
