import { NavLink } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { useCompanyModules } from '../hooks/useCompanyModules'
import { visibleNavGroups } from '../lib/navigation'
import CompanySwitcher from './CompanySwitcher'
import Icon from './ui/Icon'

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen, isTabletCollapsed, setIsTabletCollapsed }) => {
  const { t } = useLanguage()
  const permissions = usePermissions()
  const { modules, loading: modulesLoading } = useCompanyModules()
  const visibleModules = modulesLoading ? Object.fromEntries(Object.keys(modules).map(key => [key, false])) : modules
  const closeMobile = () => setIsMobileMenuOpen(false)

  const renderLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      onClick={closeMobile}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      title={isTabletCollapsed ? t(`nav.${item.key}`) : undefined}
    >
      <span className="nav-icon" aria-hidden="true">
        <Icon name={item.icon} />
      </span>
      <span className="nav-label">{t(`nav.${item.key}`)}</span>
    </NavLink>
  )

  return (
    <aside className={`sidebar ${isTabletCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-visible' : ''}`}>
      <button
        type="button"
        className="mobile-close-btn"
        onClick={closeMobile}
        title={t('sidebar.closeMenuTitle')}
        aria-label={t('sidebar.closeMenuTitle')}
      >
        <Icon name="close" size={22} />
      </button>

      <CompanySwitcher onSwitch={closeMobile} />

      <nav className="sidebar-nav" aria-label={t('sidebar.navLabel')}>
        {visibleNavGroups(permissions, visibleModules).map((group) => (
          group.key === 'main' ? (
            <div key={group.key} className="nav-group">{group.items.map(renderLink)}</div>
          ) : (
            <div key={group.key} className="nav-group" role="group" aria-labelledby={`nav-group-${group.key}`}>
              <span id={`nav-group-${group.key}`} className="nav-group-title">{t(`nav.groups.${group.key}`)}</span>
              {group.items.map(renderLink)}
            </div>
          )
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink
          to="/profile"
          onClick={closeMobile}
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          title={isTabletCollapsed ? t('nav.myAccount') : undefined}
        >
          <span className="nav-icon" aria-hidden="true"><Icon name="user" /></span>
          <span className="nav-label">{t('nav.myAccount')}</span>
        </NavLink>

        <button
          type="button"
          className="nav-link sidebar-collapse desktop-only"
          onClick={() => setIsTabletCollapsed(!isTabletCollapsed)}
          aria-expanded={!isTabletCollapsed}
          aria-label={isTabletCollapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
          title={isTabletCollapsed ? t('sidebar.expandMenu') : undefined}
        >
          <span className="nav-icon">
            <Icon name={isTabletCollapsed ? 'chevronRight' : 'chevronLeft'} />
          </span>
          <span className="nav-label">{t('sidebar.collapseMenu')}</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
