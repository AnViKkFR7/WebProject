import { useState, useEffect } from 'react'
import { userService } from '../services/userService'
import { companyService } from '../services/companyService'
import { authService } from '../services/authService'
import { useLanguage } from '../contexts/LanguageContext'
import { useCompany } from '../contexts/CompanyContext'

// Import Tabs
import PersonalTab from '../components/profile/PersonalTab'
import SecurityTab from '../components/profile/SecurityTab'
import CompanyTab from '../components/profile/CompanyTab'
import CreateCompanyTab from '../components/profile/CreateCompanyTab'
import CreateUserTab from '../components/profile/CreateUserTab'
import AssignUserTab from '../components/profile/AssignUserTab'

const Profile = () => {
  const { t } = useLanguage()
  const { selectedCompany } = useCompany()
  const [activeTab, setActiveTab] = useState('personal')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Data States
  const [companies, setCompanies] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [memberProfile, setMemberProfile] = useState(null)

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        checkAdminStatus(),
        loadUserData(),
        loadCompanies()
      ])
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (selectedCompany?.id) {
      loadMemberProfile()
    }
  }, [selectedCompany])

  const checkAdminStatus = async () => {
    try {
      const adminStatus = await userService.isCurrentUserAdmin()
      setIsAdmin(adminStatus)
    } catch (error) {
      console.error('Error verificando admin:', error)
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
    } catch (error) {
      console.error('Error cargando perfil del miembro:', error)
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
          {/* Tabs Header */}
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
                <button
                  className={`tab-button ${activeTab === 'assign-user' ? 'active' : ''}`}
                  onClick={() => setActiveTab('assign-user')}
                >
                  {t('profile.tabs.assignUser')}
                </button>
              </>
            )}
          </div>

          {/* Main Content */}
          <main>
            {activeTab === 'personal' && (
              <PersonalTab 
                selectedCompany={selectedCompany} 
                currentUser={currentUser} 
              />
            )}

            {activeTab === 'security' && (
              <SecurityTab />
            )}

            {activeTab === 'company' && (
              <CompanyTab 
                selectedCompany={selectedCompany} 
                memberProfile={memberProfile} 
              />
            )}

            {isAdmin && activeTab === 'create-company' && (
              <CreateCompanyTab 
                onCompanyCreated={loadCompanies} 
              />
            )}

            {isAdmin && activeTab === 'create-user' && (
              <CreateUserTab 
                companies={companies} 
              />
            )}

            {isAdmin && activeTab === 'assign-user' && (
              <AssignUserTab 
                companies={companies} 
              />
            )}
          </main>
        </div>
      )}
    </div>
  )
}

export default Profile
