import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { companyService } from '../services/companyService'
import { useCompany } from '../contexts/CompanyContext'
import { formatPhoneNumber } from '../lib/phoneUtils'
import { useLanguage } from '../contexts/LanguageContext'

const Users = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Editing state
  const [editingUsers, setEditingUsers] = useState({})
  const [originalValues, setOriginalValues] = useState({})
  const [savingUser, setSavingUser] = useState(null)

  useEffect(() => {
    if (selectedCompany?.id) {
      loadUsers()
    }
  }, [selectedCompany?.id])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) return
      setCurrentUserId(currentUser.id)

      // Get current user's role in selected company
      const { data: currentMembership } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', selectedCompany.id)
        .eq('user_id', currentUser.id)
        .single()
      
      setCurrentUserRole(currentMembership?.role || null)

      // Get all members of the selected company with their profile data
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('user_id, role, full_name, phone')
        .eq('company_id', selectedCompany.id)

      if (membersError) throw membersError

      // Calculate items and blogs created for each user
      const usersWithCounts = await Promise.all(
        members.map(async (member) => {
          let itemsCount = 0
          let blogsCount = 0

          // Only calculate for editors and admins
          if (member.role === 'admin' || member.role === 'editor') {
            // Count items created
            const { count: items } = await supabase
              .from('items')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', selectedCompany.id)
              .eq('created_by', member.user_id)

            itemsCount = items || 0

            // Count blog posts created
            const { count: blogs } = await supabase
              .from('blog_posts')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', selectedCompany.id)
              .eq('created_by', member.user_id)

            blogsCount = blogs || 0
          }

          return {
            userId: member.user_id,
            fullName: member.full_name || 'Sin nombre',
            phone: member.phone || '',
            role: member.role,
            itemsCreated: itemsCount,
            blogsCreated: blogsCount
          }
        })
      )

      setUsers(usersWithCounts)
    } catch (err) {
      console.error('Error loading users:', err)
      setError(t('errors.loadingUsers'))
    } finally {
      setLoading(false)
    }
  }

  const canEdit = () => {
    return currentUserRole === 'admin' || currentUserRole === 'editor'
  }

  const canEditRole = (targetRole) => {
    if (currentUserRole === 'admin') return true
    // Editors can only promote viewers to editors
    if (currentUserRole === 'editor' && targetRole === 'viewer') return true
    return false
  }

  const getAvailableRoles = (targetRole) => {
    if (currentUserRole === 'admin') return ['admin', 'editor', 'viewer']
    if (currentUserRole === 'editor' && targetRole === 'viewer') return ['viewer', 'editor']
    return []
  }

  const startEdit = (userId) => {
    const user = users.find(u => u.userId === userId)
    setEditingUsers(prev => ({ ...prev, [userId]: true }))
    setOriginalValues(prev => ({
      ...prev,
      [userId]: {
        fullName: user.fullName,
        phone: user.phone,
        role: user.role
      }
    }))
  }

  const cancelEdit = (userId) => {
    setUsers(prev => prev.map(u => 
      u.userId === userId 
        ? { ...u, ...originalValues[userId] }
        : u
    ))
    setEditingUsers(prev => ({ ...prev, [userId]: false }))
    delete originalValues[userId]
  }

  const handleFieldChange = (userId, field, value) => {
    setUsers(prev => prev.map(u =>
      u.userId === userId ? { ...u, [field]: value } : u
    ))
  }

  const saveUser = async (userId) => {
    try {
      setSavingUser(userId)
      const user = users.find(u => u.userId === userId)
      const originalRole = originalValues[userId]?.role

      const roleChanged = canEditRole(originalRole) && originalRole !== user.role

      // Build update object
      const updateData = {
        full_name: user.fullName,
        phone: user.phone
      }

      // Update company_members (includes full_name, phone, and optionally role)
      const { error: updateError } = await supabase
        .from('company_members')
        .update(updateData)
        .eq('company_id', selectedCompany.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      if (roleChanged) {
        await companyService.updateMemberRole(selectedCompany.id, userId, user.role)
      }

      setEditingUsers(prev => ({ ...prev, [userId]: false }))
      delete originalValues[userId]
      
      // Reload to refresh counts if role changed
      if (roleChanged) {
        await loadUsers()
      }
    } catch (err) {
      console.error('Error saving user:', err)
      alert('Error al guardar los cambios: ' + err.message)
    } finally {
      setSavingUser(null)
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return '#ef4444' // red
      case 'editor':
        return '#3b82f6' // blue
      case 'viewer':
        return '#6b7280' // gray
      default:
        return '#6b7280'
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'editor':
        return 'Editor'
      case 'viewer':
        return 'Viewer'
      default:
        return role
    }
  }

  if (!selectedCompany) {
    return (
      <div className="page-content">
        <section className="page-header">
          <div>
            <h2>{t('users.title')}</h2>
            <p>{t('dashboard.selectCompanyDescription')}</p>
          </div>
        </section>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('dashboard.selectCompany')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>{t('users.title')}</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '800px' }}>
            {t('users.description')}
          </p>
        </div>
      </section>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--error-bg)',
          color: 'var(--error-color)',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>{t('common.loading')}</p>
        </div>
      ) : users.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('users.noUsers')}
          </p>
        </div>
      ) : (
        <>
          {/* Buscador */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                fontSize: '1rem', 
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
                zIndex: 9
              }}>
                🔍
              </span>
              <input
                type="text"
                className="input"
                placeholder={t('users.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '2.5rem',
                  paddingRight: searchQuery ? '2.5rem' : '0.875rem',
                  fontSize: '0.9375rem'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: 'var(--text-secondary)',
                    padding: '0',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '1.5rem'
          }}>
          {users
            .filter(user => 
              user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((user) => (
            <div key={user.userId} className="card" style={{ position: 'relative' }}>
              {/* Edit button */}
              {canEdit() && (
                <button
                  onClick={() => editingUsers[user.userId] ? cancelEdit(user.userId) : startEdit(user.userId)}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: editingUsers[user.userId] ? 'var(--danger-color)' : 'var(--text-secondary)',
                    padding: '0.25rem',
                    transition: 'color 0.2s'
                  }}
                >
                  {editingUsers[user.userId] ? '✕' : '✏️'}
                </button>
              )}

              <div style={{ paddingRight: '2rem' }}>
                {/* Full Name */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem'
                  }}>
                    {t('users.fullName')}
                  </label>
                  {editingUsers[user.userId] ? (
                    <input
                      type="text"
                      className="input"
                      value={user.fullName}
                      onChange={(e) => handleFieldChange(user.userId, 'fullName', e.target.value)}
                      placeholder={t('users.fullName')}
                      style={{ fontSize: '1rem' }}
                    />
                  ) : (
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      {user.fullName}
                    </div>
                  )}
                </div>

                {/* Role Badge */}
                <div style={{ marginBottom: '1rem' }}>
                  {editingUsers[user.userId] && canEditRole(originalValues[user.userId].role) ? (
                    <select
                      className="select"
                      value={user.role}
                      onChange={(e) => handleFieldChange(user.userId, 'role', e.target.value)}
                      style={{ fontSize: '0.875rem' }}
                    >
                      {getAvailableRoles(originalValues[user.userId].role).map(roleOption => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption === 'admin' ? t('dashboard.admin') : roleOption === 'editor' ? t('dashboard.editor') : t('dashboard.viewer')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: getRoleBadgeColor(user.role) + '20',
                      color: getRoleBadgeColor(user.role)
                    }}>
                      {getRoleLabel(user.role)}
                    </span>
                  )}
                </div>

                {/* Phone */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem'
                  }}>
                    {t('users.phone')}
                  </label>
                  {editingUsers[user.userId] ? (
                    <input
                      type="tel"
                      className="input"
                      value={user.phone}
                      onChange={(e) => handleFieldChange(user.userId, 'phone', e.target.value)}
                      placeholder={t('users.noPhone')}
                      style={{ fontSize: '0.875rem' }}
                    />
                  ) : (
                    <div style={{
                      fontSize: '0.875rem',
                      color: user.phone ? 'var(--text-primary)' : 'var(--text-tertiary)'
                    }}>
                      {user.phone ? formatPhoneNumber(user.phone) : t('users.noPhone')}
                    </div>
                  )}
                </div>

                {/* Stats - Only for admin and editor */}
                {(user.role === 'admin' || user.role === 'editor') && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    marginTop: '1.5rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-color)'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.25rem'
                      }}>
                        {t('users.itemsCreated')}
                      </div>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: 'var(--primary-color)'
                      }}>
                        {user.itemsCreated}
                      </div>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.25rem'
                      }}>
                        {t('users.blogsCreated')}
                      </div>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: 'var(--primary-color)'
                      }}>
                        {user.blogsCreated}
                      </div>
                    </div>
                  </div>
                )}

                {/* Save button when editing */}
                {editingUsers[user.userId] && (
                  <button
                    onClick={() => saveUser(user.userId)}
                    disabled={savingUser === user.userId}
                    className="primary-button"
                    style={{
                      width: '100%',
                      marginTop: '1rem'
                    }}
                  >
                    {savingUser === user.userId ? t('users.savingChanges') : t('users.saveChanges')}
                  </button>
                )}
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Users
