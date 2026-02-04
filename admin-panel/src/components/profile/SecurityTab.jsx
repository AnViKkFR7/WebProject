import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../../services/authService'
import { useLanguage } from '../../contexts/LanguageContext'

const SecurityTab = () => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  })
  
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Función para validar contraseña segura
  const validatePassword = (password) => {
    if (password.length < 10) return t('profile.messages.passwordMinLength')
    if (!/[A-Z]/.test(password)) return t('profile.messages.passwordUppercase')
    if (!/[a-z]/.test(password)) return t('profile.messages.passwordLowercase')
    if (!/[0-9]/.test(password)) return t('profile.messages.passwordNumber')
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) return t('profile.messages.passwordSpecial')
    return null
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      // Validar que las contraseñas coincidan
      if (passwordFormData.newPassword !== passwordFormData.confirmNewPassword) {
        setErrorMessage(t('profile.messages.passwordsDoNotMatch'))
        setLoading(false)
        return
      }

      // Validar contraseña segura
      const passwordError = validatePassword(passwordFormData.newPassword)
      if (passwordError) {
        setErrorMessage(passwordError)
        setLoading(false)
        return
      }

      await authService.updatePassword(passwordFormData.newPassword)
      setSuccessMessage(t('profile.messages.passwordUpdated'))
      setPasswordFormData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      })
    } catch (error) {
      setErrorMessage(error.message || t('profile.messages.passwordUpdateError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tab-content animated-card">
      <div className="card-header">
        <h3>{t('profile.security.title')}</h3>
        <p>{t('profile.security.description')}</p>
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

      <div style={{
        background: 'var(--bg-info)',
        border: '1px solid var(--border-info)',
        borderRadius: '8px',
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{t('profile.security.requirements.title')}</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.8' }}>
          <li>{t('profile.security.requirements.minLength')}</li>
          <li>{t('profile.security.requirements.uppercase')}</li>
          <li>{t('profile.security.requirements.lowercase')}</li>
          <li>{t('profile.security.requirements.number')}</li>
          <li>{t('profile.security.requirements.special')}</li>
        </ul>
      </div>

      <form onSubmit={handleChangePassword}>
        <div className="form-grid">
          <label className="form-group">
            <span>{t('profile.security.newPassword')}</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? "text" : "password"}
                className="input"
                value={passwordFormData.newPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                required
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: 'var(--text-secondary)',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showNewPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </label>
          <label className="form-group">
            <span>{t('profile.security.confirmNewPassword')}</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="input"
                value={passwordFormData.confirmNewPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmNewPassword: e.target.value })}
                required
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: 'var(--text-secondary)',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </label>
        </div>
        <div className="card-footer" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? t('profile.security.updating') : t('profile.security.updatePassword')}
          </button>
        </div>
      </form>

      {/* Legal Section */}
      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t('profile.security.legalTitle')}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {t('profile.security.legalDescription')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/legal-notice" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
            {t('profile.security.legalNotice')}
          </Link>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <Link to="/privacy-policy" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
            {t('profile.security.privacyPolicy')}
          </Link>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <Link to="/cookies-policy" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
            {t('profile.security.cookiesPolicy')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SecurityTab
