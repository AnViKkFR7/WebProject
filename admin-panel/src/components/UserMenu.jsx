import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { useCompany } from '../contexts/CompanyContext'
import { usePermissions } from '../hooks/usePermissions'
import { useTheme } from '../hooks/useTheme'
import Icon from './ui/Icon'

/** Menú de cuenta de la topbar: perfil, seguridad, idioma, tema y salir. */
const UserMenu = () => {
  const navigate = useNavigate()
  const { language, toggleLanguage, t } = useLanguage()
  const { toast } = useFeedback()
  const { user, selectedCompany } = useCompany()
  const { role, isPlatformAdmin } = usePermissions()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const email = user?.email || ''
  const name = selectedCompany?.memberName || email.split('@')[0] || t('sidebar.userFallbackName')
  const roleLabel = isPlatformAdmin ? t('userMenu.platformAdmin') : role ? t(`dashboard.${role}`) : ''

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.querySelector('[role="menuitem"]')?.focus()
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onMenuKeyDown = (event) => {
    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])
    const index = items.indexOf(document.activeElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(index + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const go = (path) => {
    setOpen(false)
    navigate(path)
  }

  const handleLogout = async () => {
    setOpen(false)
    try {
      await authService.logout()
      navigate('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      toast.error(t('feedback.logoutError'))
    }
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="user-avatar" aria-hidden="true">{(name[0] || 'U').toUpperCase()}</span>
        <span className="user-chip-text">
          <span className="user-name">{name}</span>
          {roleLabel && <span className="user-role">{roleLabel}</span>}
        </span>
        <Icon name="chevronDown" size={16} className="user-chip-chevron" />
      </button>

      {open && (
        <div className="user-menu-panel" role="menu" ref={menuRef} onKeyDown={onMenuKeyDown} aria-label={t('userMenu.label')}>
          <div className="user-menu-header" role="presentation">
            <span className="user-menu-name">{name}</span>
            {email && <span className="user-menu-email">{email}</span>}
          </div>
          <button type="button" role="menuitem" className="user-menu-item" onClick={() => go('/profile')}>
            <Icon name="user" size={18} />{t('userMenu.profile')}
          </button>
          <button type="button" role="menuitem" className="user-menu-item" onClick={() => go('/profile/security')}>
            <Icon name="lock" size={18} />{t('userMenu.security')}
          </button>
          <div className="user-menu-divider" role="separator" />
          <button type="button" role="menuitem" className="user-menu-item" onClick={toggleLanguage}>
            <Icon name="globe" size={18} />{t('userMenu.language')}
            <span className="user-menu-value">{language === 'es' ? 'Español' : 'English'}</span>
          </button>
          <button type="button" role="menuitem" className="user-menu-item" onClick={toggleTheme}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
            {theme === 'light' ? t('sidebar.darkMode') : t('sidebar.lightMode')}
          </button>
          <div className="user-menu-divider" role="separator" />
          <button type="button" role="menuitem" className="user-menu-item danger" onClick={handleLogout}>
            <Icon name="logout" size={18} />{t('topbar.logout')}
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
