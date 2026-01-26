import { useState, useEffect } from 'react'
import { userService } from '../services/userService'
import { companyService } from '../services/companyService'

const Profile = () => {
  const [activeTab, setActiveTab] = useState('personal') // personal | security | company | create-company | create-user
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  
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
  
  // Estado para almacenar info del usuario creado
  const [createdUserInfo, setCreatedUserInfo] = useState(null)

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
    if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres'
    if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula'
    if (!/[a-z]/.test(password)) return 'La contraseña debe contener al menos una minúscula'
    if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número'
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) return 'La contraseña debe contener al menos un símbolo especial'
    return null
  }

  // Función para copiar al portapapeles
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Información copiada al portapapeles')
      })
      .catch(err => {
        console.error('Error al copiar:', err)
      })
  }

  useEffect(() => {
    checkAdminStatus()
    loadCompanies()
  }, [])

  // Limpiar mensajes al cambiar de pestaña
  useEffect(() => {
    setErrorMessage('')
    setSuccessMessage('')
    setCreatedUserInfo(null)
  }, [activeTab])

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

  const handleCreateCompany = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result = await companyService.createCompany(newCompany)
      setSuccessMessage(`Compañía "${newCompany.name}" creada exitosamente`)
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
      setErrorMessage(error.message || 'Error al crear la compañía')
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
          role: newUser.role === 'editor' ? 'Editor' : 'Viewer'
        })
        
        setSuccessMessage('Usuario creado exitosamente con contraseña')
      } else {
        await userService.inviteUser({
          email: newUser.email,
          full_name: newUser.full_name,
          company_id: newUser.company_id,
          role: newUser.role
        })
        setSuccessMessage('Usuario invitado exitosamente. Se ha enviado un email de invitación.')
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
      setErrorMessage(error.message || 'Error al crear el usuario')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Mi Perfil</h2>
          <p>Gestiona tu información personal y preferencias.</p>
        </div>
      </section>

      {loading ? (
        <div className="loading-state">Cargando...</div>
      ) : (
        <div>
          {/* Pestañas (Tabs) */}
          <div className="tabs-header">
            <button 
              className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              Información Personal
            </button>
            <button 
              className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Seguridad
            </button>
            <button 
              className={`tab-button ${activeTab === 'company' ? 'active' : ''}`}
              onClick={() => setActiveTab('company')}
            >
              Mi Organización
            </button>
            
            {/* Pestañas solo para Admin */}
            {isAdmin && (
              <>
                <button 
                  className={`tab-button ${activeTab === 'create-company' ? 'active' : ''}`}
                  onClick={() => setActiveTab('create-company')}
                >
                  🏢 Crear Compañía
                </button>
                <button 
                  className={`tab-button ${activeTab === 'create-user' ? 'active' : ''}`}
                  onClick={() => setActiveTab('create-user')}
                >
                  👤 Crear Usuario
                </button>
              </>
            )}
          </div>

          {/* Contenido principal con estilo Tab Content Attached */}
          <main>
          
          {activeTab === 'personal' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Información Básica</h3>
                <p>Esta información será visible para otros miembros de tu empresa.</p>
              </div>
              
              <div className="form-grid">
                <div className="avatar-section">
                  <div className="avatar-large">JM</div>
                  <button className="ghost-button small">Cambiar foto</button>
                </div>

                <label className="form-group">
                  <span>Nombre Completo</span>
                  <input type="text" className="input" defaultValue="Joselyn Mejía" />
                </label>

                <label className="form-group">
                  <span>Correo Electrónico</span>
                  <input type="email" className="input" defaultValue="joselyn@email.com" disabled />
                  <span className="help-text">El email no se puede cambiar.</span>
                </label>

                <label className="form-group">
                  <span>Teléfono</span>
                  <input type="tel" className="input" defaultValue="+34 600 000 000" />
                </label>
              </div>

              <div className="card-footer">
                <button className="primary-button">Guardar cambios</button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Cambiar Contraseña</h3>
                <p>Asegúrate de usar una contraseña segura.</p>
              </div>
              <div className="form-grid">
                <label className="form-group full-width">
                  <span>Contraseña Actual</span>
                  <input type="password" className="input" />
                </label>
                <label className="form-group">
                  <span>Nueva Contraseña</span>
                  <input type="password" className="input" />
                </label>
                <label className="form-group">
                  <span>Confirmar Nueva</span>
                  <input type="password" className="input" />
                </label>
              </div>
              <div className="card-footer" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <button className="primary-button">Actualizar contraseña</button>
              </div>

              <div className="card-header">
                <h3>Sesiones Activas</h3>
              </div>
              <div className="table">
                <div className="table-row">
                  <span className="row-title">Windows PC - Chrome</span>
                  <span className="pill published">Actual</span>
                </div>
                <div className="table-row">
                  <span className="row-title">iPhone 13 - Safari</span>
                  <span className="text-secondary">Hace 2 días</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Mi Organización</h3>
                <p>Configuración rápida para editores.</p>
              </div>
              
              <div className="info-banner">
                <span className="icon">ℹ️</span>
                <p>Eres <strong>Editor</strong> en <em>Regiamare</em>. Tienes permisos para gestionar items y usuarios.</p>
              </div>

              <div className="settings-list">
                <div className="setting-item">
                  <div className="setting-info">
                    <h4>Logotipo de la empresa</h4>
                    <p>Visible en facturas y cabecera pública.</p>
                  </div>
                  <button className="ghost-button">Subir logo</button>
                </div>
                
                <div className="setting-item">
                  <div className="setting-info">
                    <h4>Notificaciones de equipo</h4>
                    <p>Recibir aviso cuando un miembro publique un item.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA: Crear Compañía (Solo Admin) */}
          {isAdmin && activeTab === 'create-company' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Crear Nueva Compañía</h3>
                <p>Solo los administradores pueden crear nuevas compañías en el sistema.</p>
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
                    <span>Nombre de la Compañía *</span>
                    <input 
                      type="text" 
                      className="input" 
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                      required 
                    />
                  </label>

                  <label className="form-group">
                    <span>Email de Contacto *</span>
                    <input 
                      type="email" 
                      className="input" 
                      value={newCompany.contact_email}
                      onChange={(e) => setNewCompany({...newCompany, contact_email: e.target.value})}
                      required 
                    />
                  </label>

                  <label className="form-group">
                    <span>Teléfono de Contacto *</span>
                    <input 
                      type="tel" 
                      className="input" 
                      value={newCompany.contact_phone}
                      onChange={(e) => setNewCompany({...newCompany, contact_phone: e.target.value})}
                      required 
                    />
                  </label>

                  <label className="form-group full-width">
                    <span>Descripción</span>
                    <textarea 
                      className="input" 
                      rows="4"
                      value={newCompany.description}
                      onChange={(e) => setNewCompany({...newCompany, description: e.target.value})}
                    ></textarea>
                  </label>

                  <label className="form-group">
                    <span>Sitio Web</span>
                    <input 
                      type="url" 
                      className="input" 
                      placeholder="https://ejemplo.com"
                      value={newCompany.website_url}
                      onChange={(e) => setNewCompany({...newCompany, website_url: e.target.value})}
                    />
                  </label>

                  <label className="form-group">
                    <span>Logo URL</span>
                    <input 
                      type="url" 
                      className="input" 
                      placeholder="https://..."
                      value={newCompany.logo_url}
                      onChange={(e) => setNewCompany({...newCompany, logo_url: e.target.value})}
                    />
                  </label>
                </div>

                <div className="card-footer">
                  <button 
                    type="submit" 
                    className="primary-button"
                    disabled={formLoading}
                  >
                    {formLoading ? 'Creando...' : 'Crear Compañía'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PESTAÑA: Crear Usuario (Solo Admin) */}
          {isAdmin && activeTab === 'create-user' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Crear Nuevo Usuario</h3>
                <p>Solo los administradores pueden crear nuevos usuarios en el sistema.</p>
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
                    <span>Email del Usuario *</span>
                    <input 
                      type="email" 
                      className="input" 
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      required 
                    />
                  </label>

                  <label className="form-group full-width">
                    <span>Nombre Completo *</span>
                    <input 
                      type="text" 
                      className="input" 
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                      required 
                    />
                  </label>

                  <label className="form-group">
                    <span>Compañía *</span>
                    <select 
                      className="input"
                      value={newUser.company_id}
                      onChange={(e) => setNewUser({...newUser, company_id: e.target.value})}
                      required
                    >
                      <option value="">Seleccionar compañía...</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-group">
                    <span>Rol *</span>
                    <select 
                      className="input"
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      required
                    >
                      <option value="viewer">Viewer (Solo lectura)</option>
                      <option value="editor">Editor (Lectura/Escritura)</option>
                    </select>
                  </label>

                  <label className="form-group full-width">
                    <span>Modo de Creación *</span>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="radio" 
                          name="invitation_mode"
                          value="password"
                          checked={newUser.invitation_mode === 'password'}
                          onChange={(e) => setNewUser({...newUser, invitation_mode: e.target.value})}
                        />
                        <span>Con contraseña</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="radio" 
                          name="invitation_mode"
                          value="invitation"
                          checked={newUser.invitation_mode === 'invitation'}
                          onChange={(e) => setNewUser({...newUser, invitation_mode: e.target.value})}
                        />
                        <span>Por invitación (email)</span>
                      </label>
                    </div>
                  </label>

                  {newUser.invitation_mode === 'password' && (
                    <>
                      <label className="form-group full-width">
                        <span>Contraseña *</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input 
                              type={showPassword ? 'text' : 'password'}
                              className="input" 
                              value={newUser.password}
                              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                              required={newUser.invitation_mode === 'password'}
                              autoComplete="new-password"
                              style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
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
                            onClick={() => setNewUser({...newUser, password: generateSecurePassword()})}
                            style={{ whiteSpace: 'nowrap', marginTop: '0' }}
                          >
                            Generar
                          </button>
                        </div>
                        <span className="help-text">
                          Mínimo 10 caracteres, incluir mayúsculas, números y símbolos especiales
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
                        Se enviará un email de invitación al usuario para que establezca su propia contraseña.
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
                    {formLoading ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>

              {/* Contenedor con información del usuario creado (solo cuando se crea con contraseña) */}
              {createdUserInfo && (
                <div style={{
                  marginTop: '2rem',
                  background: '#f5f5f5',
                  border: '2px solid #2196f3',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#1976d2' }}>
                    ✅ Usuario Creado Exitosamente
                  </h4>
                  <div style={{ 
                    background: 'white', 
                    padding: '1rem', 
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    lineHeight: '1.8'
                  }}>
                    <div><strong>Nombre:</strong> {createdUserInfo.full_name}</div>
                    <div><strong>Email:</strong> {createdUserInfo.email}</div>
                    <div><strong>Contraseña:</strong> {createdUserInfo.password}</div>
                    <div><strong>Compañía:</strong> {createdUserInfo.company_name}</div>
                    <div><strong>Rol:</strong> {createdUserInfo.role}</div>
                  </div>
                  <button 
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      const info = `
Nuevo Usuario Creado
━━━━━━━━━━━━━━━━━━━━━━━
Nombre: ${createdUserInfo.full_name}
Email: ${createdUserInfo.email}
Contraseña: ${createdUserInfo.password}
Compañía: ${createdUserInfo.company_name}
Rol: ${createdUserInfo.role}
━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
                      copyToClipboard(info)
                    }}
                  >
                    📋 Copiar Información
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
