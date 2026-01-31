import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { authService } from '../services/authService'
import { useLanguage } from '../contexts/LanguageContext'

const Topbar = ({ isMobileMenuOpen, setIsMobileMenuOpen, user }) => {
  const navigate = useNavigate()
  const [isScrolled, setIsScrolled] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const { language, toggleLanguage } = useLanguage()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const handleLogout = async () => {
    try {
      await authService.logout()
      navigate('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      alert('Error al cerrar sesión')
    }
  }

  return (
    <header className={`topbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="topbar-left">
        {/* Burger Button (Mobile) */}
        <button 
          className="burger-button" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>

        <div className="topbar-text">
          <h1 className="topbar-title">Panel de administración</h1>
        </div>
      </div>
      <div className="topbar-right">
        {/* Search and Create removed as requested */}
        
        {/* Profile button for mobile */}
        <button 
          className="profile-button-mobile mobile-only" 
          onClick={() => navigate('/profile')}
          title="Perfil"
          aria-label="Ver perfil"
        >
          <div className="user-avatar-small">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
        </button>
        
        {/* Language toggle button for mobile */}
        <button 
          className="language-button-mobile mobile-only" 
          onClick={toggleLanguage}
          title={language === 'es' ? 'Cambiar a English' : 'Switch to Español'}
          aria-label="Change language"
          style={{ fontWeight: 700, fontSize: '0.875rem' }}
        >
          {language === 'es' ? 'ES' : 'EN'}
        </button>
        
        {/* Logout button for mobile */}
        <button 
          className="logout-button-mobile mobile-only" 
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
          </svg>
        </button>
        
        <div className="user-chip desktop-only" onClick={() => navigate('/profile')}>
          <div className="user-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
          <div>
            <div className="user-name">{user?.email?.split('@')[0] || 'Usuario'}</div>
            <div className="user-role">Conectado</div>
          </div>
        </div>
        
        {/* Language toggle button for desktop */}
        <button 
          className="language-button desktop-only" 
          onClick={toggleLanguage}
          title={language === 'es' ? 'Cambiar a English' : 'Switch to Español'}
          style={{ fontWeight: 700, fontSize: '0.875rem' }}
        >
          {language === 'es' ? 'ES' : 'EN'}
        </button>
        
        <button 
          className="logout-button desktop-only" 
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
          </svg>
        </button>
      </div>
    </header>
  )
}

export default Topbar
