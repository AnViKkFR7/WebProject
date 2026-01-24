import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'
import { authService } from '../services/authService'

const AdminLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    authService.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  return (
    <div className={`app-shell ${isTabletCollapsed ? 'tablet-collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isTabletCollapsed={isTabletCollapsed}
        setIsTabletCollapsed={setIsTabletCollapsed}
        user={user}
      />
      
      {/* Overlay para cerrar menú móvil al hacer click fuera */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-overlay-backdrop" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="app-main">
        <Topbar 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          user={user}
        />
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
