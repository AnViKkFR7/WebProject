import { useEffect, useRef, useState } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import CreateCompanyModal from './CreateCompanyModal'
import Icon from './ui/Icon'

// Con pocas empresas el buscador sólo estorba
const SEARCH_THRESHOLD = 6

const CompanySwitcher = ({ onSwitch }) => {
  const { selectedCompany, selectCompany, companies, isPlatformAdmin } = useCompany()
  const { t } = useLanguage()
  const { toast } = useFeedback()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    searchRef.current?.focus()
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const canSwitch = companies.length > 1
  // El admin de plataforma abre el menú aunque tenga una sola empresa: ahí está "Nueva empresa"
  const canOpen = canSwitch || isPlatformAdmin
  const visible = companies.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  const choose = (company) => {
    setOpen(false)
    setQuery('')
    if (company.id === selectedCompany?.id) return
    selectCompany(company)
    toast.info(t('feedback.companySwitched').replace('{name}', company.name))
    onSwitch?.()
  }

  const initial = selectedCompany ? selectedCompany.name.charAt(0).toUpperCase() : '·'

  return (
    <div className="sidebar-brand company-switcher" ref={rootRef}>
      <button
        type="button"
        className="company-switcher-trigger"
        onClick={() => canOpen && setOpen((o) => !o)}
        aria-haspopup={canOpen ? 'listbox' : undefined}
        aria-expanded={canOpen ? open : undefined}
        title={selectedCompany?.name}
        style={{ cursor: canOpen ? 'pointer' : 'default' }}
      >
        <span className="brand-mark" style={{ background: selectedCompany ? 'var(--primary-color)' : 'var(--text-tertiary)', color: 'white' }}>
          {initial}
        </span>
        <span className="brand-info">
          <span className="brand-title" style={{ display: 'block' }}>{selectedCompany ? selectedCompany.name : t('nav.noCompany')}</span>
          <span className="brand-subtitle" style={{ display: 'block' }}>
            {canSwitch ? t('sidebar.switchCompany') : t('sidebar.adminPanel')}
          </span>
        </span>
        {canOpen && <Icon name="chevronDown" size={16} className="company-switcher-chevron" />}
      </button>

      {open && (
        <div className="company-switcher-menu">
          {companies.length >= SEARCH_THRESHOLD && (
            <input
              ref={searchRef}
              type="search"
              className="company-switcher-search"
              placeholder={t('sidebar.searchCompany')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('sidebar.searchCompany')}
            />
          )}
          <div className="company-switcher-list" role="listbox" aria-label={t('sidebar.switchCompany')}>
            {visible.length === 0 ? (
              <div className="company-switcher-empty">{t('sidebar.noCompanyMatch')}</div>
            ) : visible.map((company) => (
              <button
                key={company.id}
                type="button"
                role="option"
                aria-selected={company.id === selectedCompany?.id}
                className="company-switcher-option"
                onClick={() => choose(company)}
              >
                <span className="company-switcher-initial">{company.name.charAt(0).toUpperCase()}</span>
                <span className="company-switcher-name">{company.name}</span>
                {company.userRole && (
                  <span className="company-switcher-role">{t(`dashboard.${company.userRole}`)}</span>
                )}
              </button>
            ))}
          </div>
          {isPlatformAdmin && (
            <button
              type="button"
              className="company-switcher-create"
              onClick={() => { setOpen(false); setCreating(true) }}
            >
              <Icon name="plus" size={16} />
              {t('sidebar.newCompany')}
            </button>
          )}
        </div>
      )}
      <CreateCompanyModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export default CompanySwitcher
