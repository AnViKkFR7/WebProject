import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/items', label: 'Items', icon: '🧩' },
  { to: '/companies', label: 'Empresas', icon: '🏢' },
  { to: '/users', label: 'Usuarios', icon: '👥' },
  { to: '/blog', label: 'Blog', icon: '✍️' },
  { to: '/media', label: 'Media', icon: '🖼️' },
  { to: '/settings', label: 'Ajustes', icon: '⚙️' },
]

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">R</span>
        <div>
          <div className="brand-title">Regiamare</div>
          <div className="brand-subtitle">Admin Panel</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="status-pill">
          <span className="status-dot" />
          Conectado a Supabase
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
