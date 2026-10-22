import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useCompany } from '../contexts/CompanyContext.jsx'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'

const AdminLayout = () => {
  const { selectedCompany, user } = useCompany()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(false)

  return (
    <>
      <div className={`app-shell ${isTabletCollapsed ? 'tablet-collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <Sidebar 
          isMobileMenuOpen={isMobileMenuOpen} 
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isTabletCollapsed={isTabletCollapsed}
          setIsTabletCollapsed={setIsTabletCollapsed}
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
          />
          <main className="page">
            <Outlet key={`${user?.id}-${selectedCompany?.id}`} />
          </main>
        </div>
      </div>
    </>
  )
}

export default AdminLayout
