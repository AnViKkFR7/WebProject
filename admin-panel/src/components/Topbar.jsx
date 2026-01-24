import { useNavigate } from 'react-router-dom'

const Topbar = ({ isMobileMenuOpen, setIsMobileMenuOpen, user }) => {
  const navigate = useNavigate()

  return (
    <header className="topbar">
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
          <p className="topbar-subtitle">Multi-tenant · Supabase · React</p>
        </div>
      </div>
      <div className="topbar-right">
        {/* Search and Create removed as requested */}
        
        <div className="user-chip desktop-only" onClick={() => navigate('/profile')}>
          <div className="user-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
          <div>
            <div className="user-name">{user?.email?.split('@')[0] || 'Usuario'}</div>
            <div className="user-role">Conectado</div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
