import { lazy, Suspense, useDeferredValue, useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'
import styles from './DocumentEditorPage.module.css'

const DocumentPreview = lazy(() => import('./DocumentPreview'))

export default function DocumentEditorPage({ title, company, status, dirty, saving, locked, onBack, actions, summary, children, invoice, t, language, kind }) {
  const [mode, setMode] = useState('edit')
  const [collapsed, setCollapsed] = useState(false)
  const heading = useRef(null)
  const workspace=useRef(null)
  const summaryBar=useRef(null)
  useEffect(() => { heading.current?.focus({ preventScroll:true }) }, [])
  useEffect(()=>{
    const measure=()=>workspace.current?.style.setProperty('--summary-height',`${summaryBar.current?.getBoundingClientRect().height || 88}px`)
    measure()
    const observer=typeof ResizeObserver==='undefined' ? null : new ResizeObserver(measure)
    if(summaryBar.current) observer?.observe(summaryBar.current)
    return ()=>observer?.disconnect()
  },[])
  const deferredInvoice = useDeferredValue(invoice)
  return <section ref={workspace} className={styles.workspace} aria-label={t('documentWorkspace.editor')}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <button className="ghost-button" aria-label={t('documentWorkspace.back')} disabled={saving} onClick={onBack}><Icon name="chevronLeft" size={17}/><span className={styles.backText}>{t('documentWorkspace.back')}</span></button>
        <div><p className={styles.eyebrow}>{company}</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p className={styles.state} role="status">{status} · {t(saving ? 'common.savingChanges' : locked ? 'documentWorkspace.readOnly' : dirty ? 'documentWorkspace.unsaved' : 'documentWorkspace.ready')}</p></div>
      </div>
      <div className={styles.actions}>{actions}</div>
    </header>
    <div ref={summaryBar} className={styles.summary}>{summary}</div>
    <div className={styles.toolbar}>
      <div className={styles.modes} role="group" aria-label={t('documentWorkspace.view')}>
        <button className="ghost-button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}><Icon name="edit" size={16}/>{t('documentWorkspace.edit')}</button>
        <button className="ghost-button" aria-pressed={mode === 'preview'} onClick={() => { setMode('preview'); setCollapsed(false) }}><Icon name="eye" size={16}/>{t('invoicing.preview')}</button>
      </div>
      <span className={styles.help}>{t('documentWorkspace.livePreview')}</span>
      <button className={`ghost-button ${styles.collapse}`} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>{t(collapsed ? 'documentWorkspace.showPreview' : 'documentWorkspace.hidePreview')}</button>
    </div>
    <div className={`${styles.grid} ${mode === 'preview' ? styles.previewMode : ''} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.formPanel} onSubmitCapture={event => {
        const invalid = [...event.target.elements].find(input => input.willValidate && !input.validity.valid)
        if (invalid) {
          let details=invalid.closest('details')
          while(details) { details.open=true;details=details.parentElement?.closest('details') }
          setMode('edit')
          requestAnimationFrame(() => { invalid.focus(); invalid.scrollIntoView?.({ block:'center' }) })
        }
      }}>{children}</div>
      <aside className={styles.previewPanel} aria-label={t('invoicing.preview')} aria-busy={deferredInvoice !== invoice}>
        <div className={styles.previewHeading}><Icon name="file" size={17}/><strong>{t('invoicing.preview')}</strong><span>{t('documentWorkspace.paper')}</span></div>
        <Suspense fallback={<p role="status">{t('common.loading')}</p>}><DocumentPreview invoice={deferredInvoice} t={t} language={language} kind={kind}/></Suspense>
      </aside>
    </div>
  </section>
}
