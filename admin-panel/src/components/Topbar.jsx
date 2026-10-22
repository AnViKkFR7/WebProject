import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { navKeyForPath } from '../lib/navigation'
import UserMenu from './UserMenu'
import Icon from './ui/Icon'

const Topbar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { pathname } = useLocation()
  const [isScrolled, setIsScrolled] = useState(false)
  const { t } = useLanguage()
  const navKey = navKeyForPath(pathname)
  const title = navKey ? t(`nav.${navKey}`) : t('topbar.title')
  const Title = /^\/(quotes|invoicing)\/.+/.test(pathname) ? 'p' : 'h1'

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.title = `${title} · ${t('topbar.title')}`
  }, [title, t])

  return (
    <header className={`topbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="topbar-left">
        <button
          type="button"
          className="burger-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={t('sidebar.toggleMenu')}
          aria-expanded={isMobileMenuOpen}
        >
          <Icon name={isMobileMenuOpen ? 'close' : 'menu'} size={22} />
        </button>

        <div className="topbar-text">
          <Title className="topbar-title">{title}</Title>
        </div>
      </div>
      <div className="topbar-right">
        <UserMenu />
      </div>
    </header>
  )
}

export default Topbar
