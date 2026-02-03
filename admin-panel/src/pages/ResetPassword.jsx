import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { useLanguage } from '../contexts/LanguageContext'

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isValidToken, setIsValidToken] = useState(null) // null = checking, true = valid, false = invalid
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()

  // Función de validación de contraseña
  const validatePassword = (password) => {
    if (password.length < 10) return t('profile.messages.passwordMinLength')
    if (!/[A-Z]/.test(password)) return t('profile.messages.passwordUppercase')
    if (!/[a-z]/.test(password)) return t('profile.messages.passwordLowercase')
    if (!/[0-9]/.test(password)) return t('profile.messages.passwordNumber')
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) return t('profile.messages.passwordSpecial')
    return null
  }

  useEffect(() => {
    // Verificar si hay un hash en la URL (Supabase envía el token en el hash)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const errorCode = hashParams.get('error_code')
    const errorDescription = hashParams.get('error_description')

    if (errorCode) {
      // Si hay un error en la URL (token expirado, inválido, etc.)
      setIsValidToken(false)
      if (errorCode === 'otp_expired') {
        setError(t('resetPassword.linkExpired'))
      } else {
        setError(errorDescription || t('resetPassword.linkInvalid'))
      }
    } else if (accessToken) {
      // Si hay un token válido
      setIsValidToken(true)
    } else {
      // No hay token en la URL
      setIsValidToken(false)
      setError(t('resetPassword.noValidLink'))
    }
  }, [])

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    // Validar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.passwordsDoNotMatch'))
      setLoading(false)
      return
    }

    // Validar contraseña segura
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    try {
      await authService.updatePassword(newPassword)
      setMessage(t('resetPassword.passwordUpdated'))
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.message || t('resetPassword.updateError'))
    } finally {
      setLoading(false)
    }
  }

  // Mientras se verifica el token
  if (isValidToken === null) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-placeholder">🔐</div>
            <h2>{t('resetPassword.verifying')}</h2>
          </div>
        </div>
      </div>
    )
  }

  // Si el token no es válido
  if (isValidToken === false) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-placeholder">⚠️</div>
            <h2>{t('resetPassword.invalidLink')}</h2>
          </div>
          
          {error && <div className="alert error">{error}</div>}
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ marginBottom: '20px' }}>
              {t('resetPassword.invalidLinkMessage')}
            </p>
            <button 
              className="primary-button full-width"
              onClick={() => navigate('/login')}
            >
              {t('resetPassword.backToLogin')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Si el token es válido, mostrar el formulario
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-placeholder">🔐</div>
          <h2>{t('resetPassword.title')}</h2>
          <p>{t('resetPassword.subtitle')}</p>
        </div>
        
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        
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
        
        <form onSubmit={handleResetPassword} className="login-form">
          <div className="form-group">
            <label htmlFor="new-password">{t('resetPassword.newPassword')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? "text" : "password"}
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder={t('resetPassword.placeholder')}
                disabled={loading}
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
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
          </div>
          
          <div className="form-group">
            <label htmlFor="confirm-password">{t('resetPassword.confirmPassword')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder={t('resetPassword.placeholderConfirm')}
                disabled={loading}
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
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
          </div>

          <button 
            type="submit" 
            className="primary-button full-width" 
            disabled={loading}
          >
            {loading ? t('resetPassword.updating') : t('resetPassword.updateButton')}
          </button>
          
          <div className="back-to-login" style={{ marginTop: '15px' }}>
            <button 
              type="button" 
              className="back-to-login-button full-width"
              onClick={() => navigate('/login')}
              disabled={loading}
            >
              {t('resetPassword.backToLogin')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
