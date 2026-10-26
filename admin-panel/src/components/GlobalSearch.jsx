import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useCompanyModules } from '../hooks/useCompanyModules'
import { useLanguage } from '../contexts/LanguageContext'
import { globalSearchService } from '../services/globalSearchService'
import Modal from './ui/Modal'
import Icon from './ui/Icon'
import styles from './GlobalSearch.module.css'

export default function GlobalSearch() {
  const { selectedCompany } = useCompany()
  const { modules, loading: modulesLoading } = useCompanyModules()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [state, setState] = useState('idle')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const requestId = useRef(0)

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const term = query.trim()
    const request = ++requestId.current
    if (term.length < 2) {
      const timer = window.setTimeout(() => {
        if (request === requestId.current) { setResults([]); setState('idle'); setActiveIndex(0) }
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      setState('loading')
      setResults([])
      globalSearchService.search(selectedCompany?.id, term, modules)
        .then(data => { if (request === requestId.current) { setResults(data); setState(data.length ? 'ready' : 'empty'); setActiveIndex(0) } })
        .catch(() => { if (request === requestId.current) { setResults([]); setState('error') } })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [open, query, selectedCompany?.id, modules])

  const close = () => { requestId.current += 1; setOpen(false); setQuery(''); setResults([]); setState('idle') }
  const choose = (result) => { close(); navigate(result.href) }
  const onInputKeyDown = (event) => {
    if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActiveIndex(index => (index + 1) % results.length) }
    if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActiveIndex(index => (index - 1 + results.length) % results.length) }
    if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]) }
  }

  return <>
    <button type="button" className={styles.trigger} onClick={() => setOpen(true)} disabled={!selectedCompany || modulesLoading} aria-haspopup="dialog">
      <Icon name="search" size={17} /><span>{t('globalSearch.open')}</span><kbd>Ctrl K</kbd>
    </button>
    <Modal open={open} onClose={close} title={t('globalSearch.title')} description={t('globalSearch.description')} icon="search" size="lg" className={styles.dialog} overlayClassName={styles.overlay} initialFocusRef={inputRef}>
      <label className={styles.searchField}>
        <Icon name="search" size={18} />
        <input ref={inputRef} type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onInputKeyDown} placeholder={t('globalSearch.placeholder')} aria-label={t('globalSearch.placeholder')} aria-controls="global-search-results" aria-activedescendant={results[activeIndex] ? `global-search-result-${activeIndex}` : undefined} />
        <kbd>ESC</kbd>
      </label>
      <div id="global-search-results" className={styles.results} role="listbox" aria-label={t('globalSearch.results')} aria-busy={state === 'loading'}>
        {state === 'idle' && <p className={styles.message}>{t('globalSearch.hint')}</p>}
        {state === 'loading' && <p className={styles.message} role="status">{t('globalSearch.loading')}</p>}
        {state === 'empty' && <p className={styles.message}>{t('globalSearch.empty')}</p>}
        {state === 'error' && <p className={styles.message} role="alert">{t('globalSearch.error')}</p>}
        {results.map((result, index) => <button type="button" role="option" aria-selected={activeIndex === index} id={`global-search-result-${index}`} key={`${result.type}:${result.id}`} className={styles.result} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(result)}>
          <span className={styles.resultIcon}><Icon name={result.type === 'item' ? 'items' : result.type === 'contact' ? 'users' : 'file'} size={17} /></span>
          <span className={styles.resultCopy}><strong>{result.title}</strong><small>{t(`globalSearch.types.${result.type}`)}{result.detail ? ` · ${result.detail}` : ''}</small></span>
          <span className={styles.enterHint}>↵</span>
        </button>)}
      </div>
      <footer className={styles.footer}><span>{t('globalSearch.navigateHint')}</span><span>↑ ↓ <b>↵</b></span></footer>
    </Modal>
  </>
}
