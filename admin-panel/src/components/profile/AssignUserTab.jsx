import { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { companyService } from '../../services/companyService'
import { useLanguage } from '../../contexts/LanguageContext'

const AssignUserTab = ({ companies }) => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  
  // State for data
  const [allUsers, setAllUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  
  // State for form
  const [assignUserFormData, setAssignUserFormData] = useState({
    company_id: '',
    user_id: '',
    role: 'viewer'
  })
  
  // State for feedback
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  // State for search/dropdowns
  const [assignUserSearch, setAssignUserSearch] = useState('')
  const [showAssignUserDropdown, setShowAssignUserDropdown] = useState(false)
  const [assignCompanySearch, setAssignCompanySearch] = useState('')
  const [showAssignCompanyDropdown, setShowAssignCompanyDropdown] = useState(false)

  useEffect(() => {
    loadAllUsers()
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAssignUserDropdown && !event.target.closest('.assign-user-group')) {
        setShowAssignUserDropdown(false)
      }
      if (showAssignCompanyDropdown && !event.target.closest('.assign-company-group')) {
        setShowAssignCompanyDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAssignUserDropdown, showAssignCompanyDropdown])

  const loadAllUsers = async () => {
    setUsersLoading(true)
    try {
      const usersData = await userService.getAllUsers()
      setAllUsers(usersData)
    } catch (error) {
      console.error('Error cargando usuarios:', error)
      setErrorMessage('Error al cargar lista de usuarios')
    } finally {
      setUsersLoading(false)
    }
  }

  const handleAssignUser = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      if (!assignUserFormData.company_id) {
        throw new Error(t('profile.assignUser.errorNoCompany'))
      }
      if (!assignUserFormData.user_id) {
        throw new Error(t('profile.assignUser.errorNoUser'))
      }

      await companyService.addMember(
        assignUserFormData.company_id,
        assignUserFormData.user_id,
        assignUserFormData.role
      )

      setSuccessMessage(t('profile.assignUser.success'))
      
      // Limpiar solo usuario, mantener empresa para asignar mas rapidos
      setAssignUserFormData(prev => ({
        ...prev,
        user_id: ''
      }))
      setAssignUserSearch('')
      
    } catch (error) {
      setErrorMessage(error.message || t('profile.assignUser.errorAssign'))
    } finally {
      setLoading(false)
    }
  }

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(assignCompanySearch.toLowerCase())
  )

  const filteredUsers = allUsers.filter(u => 
    (u.email?.toLowerCase() || '').includes(assignUserSearch.toLowerCase()) || 
    (u.user_metadata?.full_name?.toLowerCase() || '').includes(assignUserSearch.toLowerCase())
  )

  return (
    <div className="tab-content animated-card">
      <div className="card-header">
        <h3>{t('profile.assignUser.title')}</h3>
        <p>{t('profile.assignUser.description')}</p>
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

      <form onSubmit={handleAssignUser}>
        <div className="form-grid">
          
          {/* User Selection */}
          <label className="form-group full-width assign-user-group">
            <span>{t('profile.assignUser.selectUser')}</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder={t('profile.assignUser.searchUserPlaceholder')}
                value={assignUserSearch}
                onChange={(e) => {
                  setAssignUserSearch(e.target.value)
                  setShowAssignUserDropdown(true)
                }}
                onFocus={() => setShowAssignUserDropdown(true)}
                required={!assignUserFormData.user_id}
                style={{ paddingRight: assignUserSearch ? '2.5rem' : '0.875rem' }}
              />
               {/* Clear button */}
               {assignUserSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignUserSearch('')
                    setAssignUserFormData(prev => ({ ...prev, user_id: '' }))
                    setShowAssignUserDropdown(true)
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

              {showAssignUserDropdown && (
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
                  {usersLoading ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {t('profile.loading')}
                    </div>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <div
                        key={user.id}
                        onClick={() => {
                          setAssignUserFormData(prev => ({ ...prev, user_id: user.id }))
                          setAssignUserSearch(user.email || user.user_metadata?.email || '')
                          setShowAssignUserDropdown(false)
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.2s',
                          background: assignUserFormData.user_id === user.id ? 'var(--primary-light)' : 'var(--bg-card)',
                          color: 'var(--text-primary)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.target.style.background = assignUserFormData.user_id === user.id ? 'var(--primary-light)' : 'var(--bg-card)'}
                      >
                        <div style={{ fontWeight: 500 }}>{user.user_metadata?.full_name || 'No Name'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {t('profile.assignUser.noUsersFound')}
                    </div>
                  )}
                </div>
              )}
            </div>
            {assignUserFormData.user_id && (
              <span className="help-text">
                {t('profile.assignUser.selectedUser')}: {
                  allUsers.find(u => u.id === assignUserFormData.user_id)?.email
                }
              </span>
            )}
          </label>

          {/* Company Selection */}
          <label className="form-group full-width assign-company-group">
            <span>{t('profile.assignUser.selectCompany')}</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder={t('profile.createUser.companySearchPlaceholder')}
                value={assignCompanySearch}
                onChange={(e) => {
                  setAssignCompanySearch(e.target.value)
                  setShowAssignCompanyDropdown(true)
                }}
                onFocus={() => setShowAssignCompanyDropdown(true)}
                required={!assignUserFormData.company_id}
                style={{ paddingRight: assignCompanySearch ? '2.5rem' : '0.875rem' }}
              />

              {/* Clear button */}
              {assignCompanySearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignCompanySearch('')
                    setAssignUserFormData(prev => ({ ...prev, company_id: '' }))
                    setShowAssignCompanyDropdown(true)
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

              {showAssignCompanyDropdown && (
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
                  {filteredCompanies.length > 0 ? (
                    filteredCompanies.map(company => (
                      <div
                        key={company.id}
                        onClick={() => {
                          setAssignUserFormData(prev => ({ ...prev, company_id: company.id }))
                          setAssignCompanySearch(company.name)
                          setShowAssignCompanyDropdown(false)
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.2s',
                          background: assignUserFormData.company_id === company.id ? 'var(--primary-light)' : 'var(--bg-card)',
                          color: 'var(--text-primary)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.target.style.background = assignUserFormData.company_id === company.id ? 'var(--primary-light)' : 'var(--bg-card)'}
                      >
                        {company.name}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {t('profile.createUser.noCompaniesFound')}
                    </div>
                  )}
                </div>
              )}
            </div>
            {assignUserFormData.company_id && (
              <span className="help-text">
                {t('profile.createUser.selectedCompany')} {companies.find(c => c.id === assignUserFormData.company_id)?.name}
              </span>
            )}
          </label>

          <label className="form-group">
            <span>{t('profile.assignUser.role')}</span>
            <select
              className="input"
              value={assignUserFormData.role}
              onChange={(e) => setAssignUserFormData(prev => ({ ...prev, role: e.target.value }))}
              required
            >
              <option value="viewer">{t('profile.createUser.roleViewer')}</option>
              <option value="editor">{t('profile.createUser.roleEditor')}</option>
            </select>
          </label>
        </div>

        <div className="card-footer" style={{paddingTop: '1rem'}}>
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? t('profile.assignUser.assigning') : t('profile.assignUser.assign')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AssignUserTab
