import { NavLink, Navigate, useParams } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useCompany } from '../contexts/CompanyContext'
import PageHeader from '../components/ui/PageHeader'
import SlidingIndicator from '../components/ui/SlidingIndicator'
import PersonalTab from '../components/profile/PersonalTab'
import SecurityTab from '../components/profile/SecurityTab'

// La pestaña vive en la URL (/profile/security) para poder enlazarla desde el menú de usuario.
// Crear empresa / usuario y asignar usuario se movieron a /users y al selector de empresa.
// Lo relativo a la empresa vive en «Ajustes de empresa» (/settings); /profile/company redirige allí.
const TABS = [
  { path: '', key: 'personal' },
  { path: 'security', key: 'security' },
]

const Profile = () => {
  const { t } = useLanguage()
  const { tab = '' } = useParams()
  const { selectedCompany, user } = useCompany()

  if (tab === 'company') return <Navigate to="/settings" replace />
  if (!TABS.some((item) => item.path === tab)) return <Navigate to="/profile" replace />

  return (
    <div className="page-content">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />

      <nav className="tabs-header" aria-label={t('profile.title')}>
        <SlidingIndicator activeSelector=".tab-button.active" itemSelector=".tab-button" />
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
      </main>
    </div>
  )
}

export default Profile
