import { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { useLanguage } from '../../contexts/LanguageContext'

const CreateUserTab = ({ companies }) => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    company_id: '',
    role: 'viewer',
    invitation_mode: 'password'
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [companySearch, setCompanySearch] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [createdUserInfo, setCreatedUserInfo] = useState(null)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCompanyDropdown && !event.target.closest('.company-search-container')) {
        setShowCompanyDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCompanyDropdown])

  // Función para generar contraseña segura
  const generateSecurePassword = () => {
    const length = 12
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    const all = uppercase + lowercase + numbers + special

    let password = ''
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]

    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)]
    }

    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  // Función para validar contraseña segura
  const validatePassword = (password) => {
    if (password.length < 10) return t('profile.messages.passwordMinLength')
    if (!/[A-Z]/.test(password)) return t('profile.messages.passwordUppercase')
    if (!/[a-z]/.test(password)) return t('profile.messages.passwordLowercase')
    if (!/[0-9]/.test(password)) return t('profile.messages.passwordNumber')
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) return t('profile.messages.passwordSpecial')
    return null
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert(t('profile.messages.clipboardCopied'))
      })
      .catch(err => {
        console.error('Error al copiar:', err)
      })
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    setCreatedUserInfo(null)

    try {
      if (newUser.invitation_mode === 'password') {
        const passwordError = validatePassword(newUser.password)
        if (passwordError) {
          setErrorMessage(passwordError)
          setLoading(false)
          return
        }

        await userService.createUserWithPassword({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          company_id: newUser.company_id,
          role: newUser.role
        })

        const company = companies.find(c => c.id === newUser.company_id)

        setCreatedUserInfo({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          company_name: company?.name || 'N/A',
          role: newUser.role === 'editor' ? t('dashboard.editor') : t('dashboard.viewer')
        })

        setSuccessMessage(t('profile.messages.userCreatedWithPassword'))
      } else {
        await userService.inviteUser({
          email: newUser.email,
          full_name: newUser.full_name,
          company_id: newUser.company_id,
          role: newUser.role
        })
        setSuccessMessage(t('profile.messages.userInvited'))
      }

      setNewUser({
        email: '',
        password: '',
        full_name: '',
        company_id: '',
        role: 'viewer',
        invitation_mode: 'password'
      })
      setCompanySearch('')
      
    } catch (error) {
      setErrorMessage(error.message || t('profile.messages.userCreateError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tab-content animated-card">
      <div className="card-header">
        <h3>{t('profile.createUser.title')}</h3>
        <p>{t('profile.createUser.description')}</p>
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

      <form onSubmit={handleCreateUser}>
        <div className="form-grid">
          <label className="form-group full-width">
            <span>{t('profile.createUser.email')}</span>
            <input
              type="email"
              className="input"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
            />
          </label>

          <label className="form-group full-width">
            <span>{t('profile.createUser.fullName')}</span>
            <input
              type="text"
              className="input"
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              required
            />
          </label>

          <label className="form-group company-search-container">
            <span>{t('profile.createUser.company')}</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder={t('profile.createUser.companySearchPlaceholder')}
                value={companySearch}
                onChange={(e) => {
                  setCompanySearch(e.target.value)
                  setShowCompanyDropdown(true)
                }}
                onFocus={() => setShowCompanyDropdown(true)}
                required={!newUser.company_id}
                style={{ paddingRight: companySearch ? '2.5rem' : '0.875rem' }}
              />
              
              {/* Clear button */}
              {companySearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCompanySearch('')
                    setNewUser(prev => ({ ...prev, company_id: '' }))
                    setShowCompanyDropdown(true)
                  }}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: '1rem',
                    padding: '0.25rem'
                  }}
                >
                  ✕
                </button>
              )}

              {showCompanyDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '0.25rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: 'var(--shadow-md)'
                }}>
                  {companies
                    .filter(company =>
                      company.name.toLowerCase().includes(companySearch.toLowerCase())
                    )
                    .map(company => (
                      <div
                        key={company.id}
                        onClick={() => {
                          setNewUser({ ...newUser, company_id: company.id })
                          setCompanySearch(company.name)
                          setShowCompanyDropdown(false)
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.2s',
                          background: newUser.company_id === company.id ? 'var(--primary-light)' : 'var(--bg-card)',
                          color: 'var(--text-primary)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.target.style.background = newUser.company_id === company.id ? 'var(--primary-light)' : 'var(--bg-card)'}
                      >
                        {company.name}
                      </div>
                    ))}
                  {companies.filter(company =>
                    company.name.toLowerCase().includes(companySearch.toLowerCase())
                  ).length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {t('profile.createUser.noCompaniesFound')}
                      </div>
                    )}
                </div>
              )}
            </div>
            {newUser.company_id && (
              <span className="help-text">
                {t('profile.createUser.selectedCompany')} {companies.find(c => c.id === newUser.company_id)?.name}
              </span>
            )}
          </label>

          <label className="form-group">
            <span>{t('profile.createUser.role')}</span>
            <select
              className="input"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              required
            >
              <option value="viewer">{t('profile.createUser.roleViewer')}</option>
              <option value="editor">{t('profile.createUser.roleEditor')}</option>
            </select>
          </label>

          <div className="form-group full-width">
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t('profile.createUser.creationMode')}</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="invitation_mode"
                  value="password"
                  checked={newUser.invitation_mode === 'password'}
                  onChange={(e) => setNewUser({ ...newUser, invitation_mode: e.target.value })}
                />
                <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{t('profile.createUser.modePassword')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="invitation_mode"
                  value="invitation"
                  checked={newUser.invitation_mode === 'invitation'}
                  onChange={(e) => setNewUser({ ...newUser, invitation_mode: e.target.value })}
                />
                <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{t('profile.createUser.modeInvitation')}</span>
              </label>
            </div>
          </div>

          {newUser.invitation_mode === 'password' && (
            <>
              <label className="form-group full-width">
                <span>{t('profile.createUser.password')}</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required={newUser.invitation_mode === 'password'}
                      autoComplete="new-password"
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? t('profile.createUser.hidePassword') : t('profile.createUser.showPassword')}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setNewUser({ ...newUser, password: generateSecurePassword() })}
                    style={{ whiteSpace: 'nowrap', marginTop: '0' }}
                  >
                    {t('profile.createUser.generatePassword')}
                  </button>
                </div>
                <span className="help-text">
                  {t('profile.createUser.passwordHelp')}
                </span>
              </label>
            </>
          )}

          {newUser.invitation_mode === 'invitation' && (
            <div className="form-group full-width">
              <div style={{
                background: '#e3f2fd',
                border: '1px solid #2196f3',
                borderRadius: '8px',
                padding: '1rem',
                color: '#0d47a1',
                fontSize: '0.9rem',
                lineHeight: '1.5'
              }}>
                {t('profile.createUser.invitationInfo')}
              </div>
            </div>
          )}
        </div>

        <div className="card-footer">
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? t('profile.createUser.creating') : t('profile.createUser.create')}
          </button>
        </div>
      </form>

      {/* Contenedor con información del usuario creado (solo cuando se crea con contraseña) */}
      {createdUserInfo && (
        <div style={{
          marginTop: '2rem',
          background: 'var(--bg-card)',
          border: '2px solid var(--primary-color)',
          borderRadius: '8px',
          padding: '1.5rem',
          color: 'var(--text-primary)'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>
            {t('profile.createUser.successTitle')}
          </h4>
          <div style={{
            background: 'var(--bg-page)',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: '1.8',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)'
          }}>
            <div><strong>{t('profile.createUser.infoName')}:</strong> {createdUserInfo.full_name}</div>
            <div><strong>{t('profile.createUser.infoEmail')}:</strong> {createdUserInfo.email}</div>
            <div><strong>{t('profile.createUser.infoPassword')}:</strong> {createdUserInfo.password}</div>
            <div><strong>{t('profile.createUser.infoCompany')}:</strong> {createdUserInfo.company_name}</div>
            <div><strong>{t('profile.createUser.infoRole')}:</strong> {createdUserInfo.role === 'editor' ? t('dashboard.editor') : t('dashboard.viewer')}</div>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              const info = `
${t('profile.createUser.successTitle')}
━━━━━━━━━━━━━━━━━━━━━━━
${t('profile.createUser.infoName')}: ${createdUserInfo.full_name}
${t('profile.createUser.infoEmail')}: ${createdUserInfo.email}
${t('profile.createUser.infoPassword')}: ${createdUserInfo.password}
${t('profile.createUser.infoCompany')}: ${createdUserInfo.company_name}
${t('profile.createUser.infoRole')}: ${createdUserInfo.role === 'editor' ? t('dashboard.editor') : t('dashboard.viewer')}
━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
              copyToClipboard(info)
            }}
          >
            {t('profile.createUser.copyInfo')}
          </button>
        </div>
      )}
    </div>
  )
}

export default CreateUserTab
