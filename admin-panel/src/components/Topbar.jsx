import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { useEffect, useState } from 'react'

const Topbar = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    authService.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">Panel de administración</h1>
        <p className="topbar-subtitle">Multi-tenant · Supabase · React</p>
      </div>
      <div className="topbar-right">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="search"
            placeholder="Buscar items, empresas, usuarios..."
            aria-label="Buscar"
          />
        </div>
        <button className="ghost-button">Crear</button>
        <div className="user-chip" onClick={() => navigate('/profile')}>
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
