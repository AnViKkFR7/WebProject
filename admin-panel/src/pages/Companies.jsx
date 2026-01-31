import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatPhoneNumber } from '../lib/phoneUtils'
import { useLanguage } from '../contexts/LanguageContext'

const Companies = () => {
  const { t } = useLanguage()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [editableCompanies, setEditableCompanies] = useState({})
  const [originalValues, setOriginalValues] = useState({})
  const [savingCompany, setSavingCompany] = useState(null)
  const [itemCounts, setItemCounts] = useState({})
  const [userCounts, setUserCounts] = useState({})

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener empresas del usuario
      const { data: memberships, error: membershipsError } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)

      if (membershipsError) throw membershipsError

      const companyIds = memberships.map(m => m.company_id)

      // Obtener datos de las empresas
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)

      if (companiesError) throw companiesError

      // Crear mapa de roles
      const rolesMap = {}
      memberships.forEach(m => {
        rolesMap[m.company_id] = m.role
      })

      // Añadir rol a cada empresa
      const companiesWithRoles = companiesData.map(company => ({
        ...company,
        userRole: rolesMap[company.id]
      }))

      setCompanies(companiesWithRoles)

      // Cargar conteo de items publicados para cada empresa
      const counts = {}
      const userCountsData = {}
      for (const company of companiesWithRoles) {
        const { count, error: countError } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('status', 'published')

        if (!countError) {
          counts[company.id] = count || 0
        }

        // Contar usuarios de la empresa
        const { count: userCount, error: userCountError } = await supabase
          .from('company_members')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)

        if (!userCountError) {
          userCountsData[company.id] = userCount || 0
        }
      }
      setItemCounts(counts)
      setUserCounts(userCountsData)

      // Guardar valores originales
      const original = {}
      companiesWithRoles.forEach(company => {
        original[company.id] = {
          description: company.description || '',
          contact_email: company.contact_email || '',
          contact_phone: company.contact_phone || '',
          website_url: company.website_url || ''
        }
      })
      setOriginalValues(original)

    } catch (err) {
      console.error('Error loading companies:', err)
      setError(t('errors.loadingCompanies'))
    } finally {
      setLoading(false)
    }
  }

  const toggleEdit = (companyId) => {
    setEditableCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }))
  }

  const handleFieldChange = (companyId, field, value) => {
    setCompanies(prev =>
      prev.map(company =>
        company.id === companyId ? { ...company, [field]: value } : company
      )
    )
  }

  const handleDiscard = (companyId) => {
    setCompanies(prev =>
      prev.map(company =>
        company.id === companyId
          ? { ...company, ...originalValues[companyId] }
          : company
      )
    )
    toggleEdit(companyId)
  }

  const handleSave = async (companyId) => {
    try {
      setSavingCompany(companyId)
      const company = companies.find(c => c.id === companyId)

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          description: company.description,
          contact_email: company.contact_email,
          contact_phone: company.contact_phone,
          website_url: company.website_url
        })
        .eq('id', companyId)

      if (updateError) throw updateError

      // Actualizar valores originales
      setOriginalValues(prev => ({
        ...prev,
        [companyId]: {
          description: company.description,
          contact_email: company.contact_email,
          contact_phone: company.contact_phone,
          website_url: company.website_url
        }
      }))

      toggleEdit(companyId)
      setSuccess('Empresa actualizada correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving company:', err)
      setError('Error al guardar los cambios')
    } finally {
      setSavingCompany(null)
    }
  }

  const canEdit = (company) => {
    return company.userRole === 'admin' || company.userRole === 'editor'
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

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>{t('companies.title')}</h2>
            <p>{t('companies.description')}</p>
          </div>
        </div>

        {error && (
          <div className="alert error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="alert success" style={{ marginBottom: '1.5rem' }}>
            {success}
          </div>
        )}

        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
          {companies.map(company => (
            <div
              key={company.id}
              className="card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                position: 'relative'
              }}
            >
              {/* Botón de editar */}
              {canEdit(company) && (
                <button
                  onClick={() => editableCompanies[company.id] ? handleDiscard(company.id) : toggleEdit(company.id)}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    color: 'var(--text-secondary)'
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
                  {editableCompanies[company.id] ? '✕' : '✏️'}
                </button>
              )}

              {/* Nombre de la empresa */}
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary)',
                paddingRight: '3rem'
              }}>
                {company.name}
              </h3>

              {/* Descripción */}
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  {t('companies.companyDescription')}
                </label>
                {editableCompanies[company.id] ? (
                  <textarea
                    className="input"
                    value={company.description || ''}
                    onChange={(e) => handleFieldChange(company.id, 'description', e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical', width: '100%' }}
                  />
                ) : (
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {company.description || t('companies.missingDescription')}
                  </p>
                )}
              </div>

              {/* Contacto */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    {t('companies.contactEmail')}
                  </label>
                  {editableCompanies[company.id] ? (
                    <input
                      type="email"
                      className="input"
                      value={company.contact_email || ''}
                      onChange={(e) => handleFieldChange(company.id, 'contact_email', e.target.value)}
                    />
                  ) : (
                    <p style={{ margin: 0, color: company.contact_email ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                      {company.contact_email || t('companies.missingEmail')}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    {t('companies.contactPhone')}
                  </label>
                  {editableCompanies[company.id] ? (
                    <input
                      type="tel"
                      className="input"
                      value={company.contact_phone || ''}
                      onChange={(e) => handleFieldChange(company.id, 'contact_phone', e.target.value)}
                    />
                  ) : (
                    <p style={{ margin: 0, color: company.contact_phone ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                      {company.contact_phone ? formatPhoneNumber(company.contact_phone) : t('companies.missingPhone')}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats: Items y Usuarios */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    {t('companies.itemsPublished')}
                  </label>
                  <p style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.5rem', fontWeight: 700 }}>
                    {itemCounts[company.id] || 0}
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    {t('companies.users')}
                  </label>
                  <p style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.5rem', fontWeight: 700 }}>
                    {userCounts[company.id] || 0}
                  </p>
                </div>
              </div>

              {/* Website */}
              <div>
                {editableCompanies[company.id] ? (
                  <>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                      {t('companies.website')}
                    </label>
                    <input
                      type="url"
                      className="input"
                      value={company.website_url || ''}
                      onChange={(e) => handleFieldChange(company.id, 'website_url', e.target.value)}
                      placeholder="https://ejemplo.com"
                    />
                  </>
                ) : company.website_url ? (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.25rem',
                      background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                      color: 'white',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '1rem',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    {t('companies.visitWebsite')}
                    <span style={{ fontSize: '0.9rem' }}>↗</span>
                  </a>
                ) : (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    background: 'var(--bg-hover)',
                    color: 'var(--text-tertiary)',
                    borderRadius: '8px',
                    fontWeight: 500,
                    fontSize: '0.95rem',
                    border: '2px dashed var(--border-color)'
                  }}>
                    {t('companies.websiteUnderConstruction')}
                  </div>
                )}
              </div>

              {/* Botón de guardar cambios */}
              {editableCompanies[company.id] && (
                <button
                  className="button button-primary button-medium"
                  onClick={() => handleSave(company.id)}
                  disabled={savingCompany === company.id}
                  style={{ marginTop: '0.5rem' }}
                >
                  {savingCompany === company.id ? t('companies.savingChanges') : `💾 ${t('common.saveChanges')}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>
              {t('dashboard.noCompanies')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Companies

