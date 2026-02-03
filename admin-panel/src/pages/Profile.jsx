import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userService } from '../services/userService'
import { companyService } from '../services/companyService'
import { authService } from '../services/authService'
import { useLanguage } from '../contexts/LanguageContext'
import { useCompany } from '../contexts/CompanyContext'

const Profile = () => {
  const { t } = useLanguage()
  const { selectedCompany } = useCompany()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('personal') // personal | security | company | create-company | create-user
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Estado para Personal Information
  const [currentUser, setCurrentUser] = useState(null)
  const [memberProfile, setMemberProfile] = useState(null)
  const [personalFormData, setPersonalFormData] = useState({
    full_name: '',
    phone: ''
  })

  // Estado para Security
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  })

  // Estado para formulario de nueva compañía
  const [newCompany, setNewCompany] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    description: '',
    website_url: '',
    logo_url: ''
  })

  // Estado para formulario de nuevo usuario
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    company_id: '',
    role: 'viewer',
    invitation_mode: 'password' // password | invitation
  })

  // Estado para listas
  const [companies, setCompanies] = useState([])
  const [formLoading, setFormLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Estado para mostrar/ocultar contraseña
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Estado para almacenar info del usuario creado
  const [createdUserInfo, setCreatedUserInfo] = useState(null)

  // Estado para búsqueda de empresas
  const [companySearch, setCompanySearch] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  // Función para generar contraseña segura
  const generateSecurePassword = () => {
    const length = 12
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    const all = uppercase + lowercase + numbers + special

    let password = ''
    // Asegurar al menos 1 de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]

    // Completar el resto
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)]
    }

    // Mezclar caracteres
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

  // Función para copiar al portapapeles
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert(t('profile.messages.clipboardCopied'))
      })
      .catch(err => {
        console.error('Error al copiar:', err)
      })
  }

  useEffect(() => {
    checkAdminStatus()
    loadCompanies()
    loadUserData()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      loadMemberProfile()
    }
  }, [selectedCompany])

  // Limpiar mensajes al cambiar de pestaña
  useEffect(() => {
    setErrorMessage('')
    setSuccessMessage('')
    setCreatedUserInfo(null)
  }, [activeTab])

  // Cerrar dropdown de empresas al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCompanyDropdown && !event.target.closest('.form-group')) {
        setShowCompanyDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCompanyDropdown])

  const checkAdminStatus = async () => {
    try {
      const adminStatus = await userService.isCurrentUserAdmin()
      setIsAdmin(adminStatus)
    } catch (error) {
      console.error('Error verificando admin:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const companiesData = await companyService.getAllCompanies()
      setCompanies(companiesData)
    } catch (error) {
      console.error('Error cargando empresas:', error)
    }
  }

  const loadUserData = async () => {
    try {
      const user = await authService.getCurrentUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('Error cargando usuario:', error)
    }
  }

  const loadMemberProfile = async () => {
    if (!selectedCompany?.id) return
    try {
      const profile = await companyService.getCurrentUserMemberProfile(selectedCompany.id)
      setMemberProfile(profile)
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

    setFormLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await companyService.updateCurrentUserMemberProfile(selectedCompany.id, personalFormData)
      setSuccessMessage(t('profile.messages.profileUpdated'))
      await loadMemberProfile()
    } catch (error) {
      setErrorMessage(error.message || t('profile.messages.profileUpdateError'))
    } finally {
      setFormLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      // Validar que las contraseñas coincidan
      if (passwordFormData.newPassword !== passwordFormData.confirmNewPassword) {
        setErrorMessage(t('profile.messages.passwordsDoNotMatch'))
        setFormLoading(false)
        return
      }

      // Validar contraseña segura
      const passwordError = validatePassword(passwordFormData.newPassword)
      if (passwordError) {
        setErrorMessage(passwordError)
        setFormLoading(false)
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
      setFormLoading(false)
    }
  }

  const handleCreateCompany = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result = await companyService.createCompany(newCompany)
      setSuccessMessage(`${t('profile.messages.companyCreatedPrefix')}${newCompany.name}${t('profile.messages.companyCreatedSuffix')}`)
      setNewCompany({
        name: '',
        contact_email: '',
        contact_phone: '',
        description: '',
        website_url: '',
        logo_url: ''
      })
      await loadCompanies()
    } catch (error) {
      setErrorMessage(error.message || t('profile.messages.companyCreateError'))
    } finally {
      setFormLoading(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    setCreatedUserInfo(null)

    try {
      if (newUser.invitation_mode === 'password') {
        // Validar contraseña
        const passwordError = validatePassword(newUser.password)
        if (passwordError) {
          setErrorMessage(passwordError)
          setFormLoading(false)
          return
        }

        const result = await userService.createUserWithPassword({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          company_id: newUser.company_id,
          role: newUser.role
        })

        // Obtener nombre de la compañía
        const company = companies.find(c => c.id === newUser.company_id)

        // Guardar info del usuario creado para mostrar
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

      // Limpiar formulario
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        company_id: '',
        role: 'viewer',
        invitation_mode: 'password'
      })
    } catch (error) {
      setErrorMessage(error.message || t('profile.messages.userCreateError'))
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>{t('profile.title')}</h2>
          <p>{t('profile.description')}</p>
        </div>
      </section>

      {loading ? (
        <div className="loading-state">{t('profile.loading')}</div>
      ) : (
        <div>
          {/* Pestañas (Tabs) */}
          <div className="tabs-header">
            <button
              className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              {t('profile.tabs.personal')}
            </button>
            <button
              className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              {t('profile.tabs.security')}
            </button>
            <button
              className={`tab-button ${activeTab === 'company' ? 'active' : ''}`}
              onClick={() => setActiveTab('company')}
            >
              {t('profile.tabs.company')}
            </button>

            {/* Pestañas solo para Admin */}
            {isAdmin && (
              <>
                <button
                  className={`tab-button ${activeTab === 'create-company' ? 'active' : ''}`}
                  onClick={() => setActiveTab('create-company')}
                >
                  {t('profile.tabs.createCompany')}
                </button>
                <button
                  className={`tab-button ${activeTab === 'create-user' ? 'active' : ''}`}
                  onClick={() => setActiveTab('create-user')}
                >
                  {t('profile.tabs.createUser')}
                </button>
              </>
            )}
          </div>

          {/* Contenido principal con estilo Tab Content Attached */}
          <main>

            {activeTab === 'personal' && (
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
                        <p style={{margin: '0'}}>{t('profile.messages.noCompanySelected')}</p>
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
                    <br/>
                    <br/>
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
                    <br/>
                    <br/>
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
                      disabled={formLoading || !selectedCompany}
                    >
                      {formLoading ? t('profile.personal.saving') : t('profile.personal.saveChanges')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
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
                      disabled={formLoading}
                    >
                      {formLoading ? t('profile.security.updating') : t('profile.security.updatePassword')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'company' && (
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
                        <p style={{margin: '0'}}>{t('profile.messages.noCompanySelected')}</p>
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
            )}

            {/* PESTAÑA: Crear Compañía (Solo Admin) */}
            {isAdmin && activeTab === 'create-company' && (
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

                  <div className="card-footer" style={{ paddingTop: '1rem'}}>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={formLoading}
                    >
                      {formLoading ? t('profile.createCompany.creating') : t('profile.createCompany.create')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* PESTAÑA: Crear Usuario (Solo Admin) */}
            {isAdmin && activeTab === 'create-user' && (
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

                    <label className="form-group">
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
                        />
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
                                tooltip={showPassword ? t('profile.createUser.hidePassword') : t('profile.createUser.showPassword')}
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
                      disabled={formLoading}
                    >
                      {formLoading ? t('profile.createUser.creating') : t('profile.createUser.create')}
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
            )}

          </main>
        </div>
      )}
    </div>
  )
}

export default Profile
