import { useEffect, useState } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import { companyService } from '../services/companyService'
import { useLanguage } from '../contexts/LanguageContext'
import { useCompany } from '../contexts/CompanyContext'
import PageHeader from '../components/ui/PageHeader'
import PersonalTab from '../components/profile/PersonalTab'
import SecurityTab from '../components/profile/SecurityTab'
import CompanyTab from '../components/profile/CompanyTab'

// La pestaña vive en la URL (/profile/security) para poder enlazarla desde el menú de usuario.
// Crear empresa / usuario y asignar usuario se movieron a /users y al selector de empresa.
const TABS = [
  { path: '', key: 'personal' },
  { path: 'security', key: 'security' },
  { path: 'company', key: 'company' },
]

const Profile = () => {
  const { t } = useLanguage()
  const { tab = '' } = useParams()
  const { selectedCompany, user } = useCompany()
  const [memberProfile, setMemberProfile] = useState(null)

  useEffect(() => {
    if (!selectedCompany?.id) return undefined
    let cancelled = false
    companyService.getCurrentUserMemberProfile(selectedCompany.id)
      .then((profile) => { if (!cancelled) setMemberProfile(profile) })
      .catch((error) => console.error('Error cargando perfil del miembro:', error))
    return () => { cancelled = true }
  }, [selectedCompany?.id])

  if (!TABS.some((item) => item.path === tab)) return <Navigate to="/profile" replace />

  return (
    <div className="page-content">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />

      <nav className="tabs-header" aria-label={t('profile.title')}>
        {TABS.map((item) => (
          <NavLink
            key={item.key}
            to={item.path ? `/profile/${item.path}` : '/profile'}
            end
            className={({ isActive }) => `tab-button${isActive ? ' active' : ''}`}
          >
            {t(`profile.tabs.${item.key}`)}
          </NavLink>
        ))}
      </nav>

      <main>
        {tab === '' && <PersonalTab selectedCompany={selectedCompany} currentUser={user} />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'company' && <CompanyTab selectedCompany={selectedCompany} memberProfile={memberProfile} />}
      </main>
    </div>
  )
}

export default Profile
