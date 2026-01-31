import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen, isTabletCollapsed, setIsTabletCollapsed, user }) => {
  const isSupabaseEnabled = import.meta.env.VITE_USE_SUPABASE === 'true'
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  
  // Theme State
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: '📊' },
    { to: '/items', label: t('nav.items'), icon: '🧩' },
    { to: '/my-data', label: t('nav.myData'), icon: '⚡' },
    { to: '/companies', label: t('nav.companies'), icon: '🏢' },
    { to: '/users', label: t('nav.users'), icon: '👥' },
    { to: '/blog', label: t('nav.blog'), icon: '✍️' },
  ]

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <>
      <aside className={`sidebar ${isTabletCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-visible' : ''}`}>
        
        {/* Mobile Close Button */}
        <button 
          className="mobile-close-btn"
          onClick={() => setIsMobileMenuOpen(false)}
          title="Cerrar menú"
        >
          <span style={{ fontSize: '1.5rem' }}>↑</span>
        </button>
        
        <div className="sidebar-brand">
          <span 
            className="brand-mark" 
            style={{
              background: selectedCompany ? 'var(--primary-color)' : '#475569',
              color: 'white'
            }}
          >
            {selectedCompany ? selectedCompany.name.charAt(0).toUpperCase() : 'X'}
          </span>
          <div className="brand-info">
            <div className="brand-title">{selectedCompany ? selectedCompany.name : t('nav.noCompany')}</div>
            <div className="brand-subtitle">Admin Panel</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
              title={isTabletCollapsed ? item.label : ''}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Mobile Menu Footer (Profile) */}
        <div className="sidebar-mobile-footer">
          <div className="divider"></div>
          {/* Create New Removed */}
          
          {user && (
            <div className="user-chip-mobile" onClick={() => {
              navigate('/profile')
              setIsMobileMenuOpen(false)
            }}>
              <div className="user-avatar">{user.email?.[0]?.toUpperCase() || 'U'}</div>
              <div className="user-info">
                <div className="user-name">{user.email?.split('@')[0] || 'Usuario'}</div>
                <div className="user-role">{t('nav.profile')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop/Tablet Footer */}
        <div className="sidebar-footer">
          {/* Profile Button - Mobile Only */}
          {user && (
            <button 
              className="theme-switch mobile-only"
              onClick={() => {
                navigate('/profile')
                setIsMobileMenuOpen(false)
              }}
              title={t('nav.profile')}
            >
              <span className="theme-switch-icon">{user.email?.[0]?.toUpperCase() || '👤'}</span>
              <span className="theme-switch-label">{t('nav.profile')}</span>
            </button>
          )}

          {/* Menu Toggle - Mobile Only */}
          <button 
            className="theme-switch mobile-only"
            onClick={() => setIsMobileMenuOpen(false)}
            title="Cerrar menú"
          >
            <span className="theme-switch-icon">✕</span>
            <span className="theme-switch-label">Cerrar Menú</span>
          </button>

          {/* Collapse Toggle (Desktop Only) */}
          <button 
            className="nav-link desktop-only" 
            onClick={() => setIsTabletCollapsed(!isTabletCollapsed)}
            style={{ width: '100%', justifyContent: isTabletCollapsed ? 'center' : 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
             <span className="nav-icon" style={{color: 'var(--primary-color)', filter: 'none'}}>
               {isTabletCollapsed ? '▶' : '◀'}
             </span>
             <span className="nav-label">{isTabletCollapsed ? '' : 'Contraer menú'}</span>
          </button>

          {/* Theme Switcher */}
          <button className="theme-switch" onClick={toggleTheme} title="Cambiar tema">
            <span className="theme-switch-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span className="theme-switch-label">{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
