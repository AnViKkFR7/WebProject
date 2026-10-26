import { lazy, Suspense, useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import RouteFallback from '../components/RouteFallback'
import { quoteApprovalService } from '../services/quoteApprovalService'
import styles from './QuoteApproval.module.css'

const DocumentPreview = lazy(() => import('../components/DocumentPreview'))

export default function QuoteApproval() {
  const { t, language } = useLanguage()
  const [token, setToken] = useState('')
  const [details, setDetails] = useState(null)
  const [state, setState] = useState('loading')
  const [decision, setDecision] = useState('accepted')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  useEffect(() => {
    const secret = window.location.hash.slice(1)
    setToken(secret)
    if (!/^[0-9a-f]{64}$/.test(secret)) { setState('unavailable'); return }
    let current = true
    quoteApprovalService.details(secret)
      .then(value => { if (current) { setDetails(value); setState(value ? (value.decision ? 'answered' : value.status === 'sent' ? 'ready' : 'unavailable') : 'unavailable') } })
      .catch(() => { if (current) setState('unavailable') })
    return () => { current = false }
  }, [])

  const submit = async event => {
    event.preventDefault()
    if (!confirmed || busy) return
    setBusy(true); setSubmitError(false)
    try {
      const result = await quoteApprovalService.respond(token, decision, name.trim(), email.trim(), reason.trim())
      setDetails(current => ({ ...current, decision: result.decision, responded_at: result.responded_at }))
      setState('answered')
      window.history.replaceState(null, '', window.location.pathname)
    } catch { setSubmitError(true) }
    finally { setBusy(false) }
  }

  return <main className={styles.page}>
    <header className={styles.header}><p>{t('quoteApproval.eyebrow')}</p><h1>{t('quoteApproval.title')}</h1><p>{t('quoteApproval.intro')}</p></header>
    {state === 'loading' && <p role="status">{t('common.loading')}</p>}
    {state === 'unavailable' && <section className={styles.notice} role="alert"><h2>{t('quoteApproval.unavailableTitle')}</h2><p>{t('quoteApproval.unavailable')}</p></section>}
    {details && state !== 'loading' && state !== 'unavailable' && <>
      <section className={styles.document} aria-label={t('quoteApproval.documentLabel')}>
        <h2>{t('quoteApproval.quoteNumber').replace('{number}', details.number)}</h2>
        <Suspense fallback={<RouteFallback />}><DocumentPreview invoice={{ number: details.number, status: details.status, document: details.document }} t={t} language={language} kind="quote" /></Suspense>
      </section>
      {state === 'answered' ? <section className={styles.notice} role="status">
        <h2>{details.decision === 'accepted' ? t('quoteApproval.accepted') : t('quoteApproval.rejected')}</h2>
        {details.responded_at && <p>{t('quoteApproval.respondedAt')}: <time dateTime={details.responded_at}>{new Date(details.responded_at).toLocaleString(language === 'en' ? 'en-GB' : 'es-ES')}</time></p>}
        <p>{t('quoteApproval.alreadyAnsweredHelp')}</p>
      </section> : <section className={styles.formPanel}>
        <p className={styles.expiry}>{t('quoteApproval.expires')} <time dateTime={details.expires_at}>{new Date(details.expires_at).toLocaleDateString(language === 'en' ? 'en-GB' : 'es-ES')}</time></p>
        <form onSubmit={submit}>
          {submitError && <p className={styles.error} role="alert">{t('quoteApproval.submitError')}</p>}
          <label className="field"><span className="field-label">{t('quoteApproval.name')}</span><input className="input" autoComplete="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={160} required /></label>
          <label className="field"><span className="field-label">{t('quoteApproval.email')}</span><input className="input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required /></label>
          <fieldset className={styles.decisions}><legend>{t('quoteApproval.decision')}</legend>
            <label><input type="radio" name="quote-decision" value="accepted" checked={decision === 'accepted'} onChange={() => { setDecision('accepted'); setConfirmed(false) }} />{t('quoteApproval.accept')}</label>
            <label><input type="radio" name="quote-decision" value="rejected" checked={decision === 'rejected'} onChange={() => { setDecision('rejected'); setConfirmed(false) }} />{t('quoteApproval.reject')}</label>
          </fieldset>
          {decision === 'rejected' && <label className="field"><span className="field-label">{t('quoteApproval.reason')}</span><textarea className="input" rows={3} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>}
          <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />{t('quoteApproval.confirm').replace('{decision}', decision === 'accepted' ? t('quoteApproval.accept').toLowerCase() : t('quoteApproval.reject').toLowerCase())}</label>
          <button className="primary-button" type="submit" disabled={busy || !confirmed}>{busy ? t('common.loading') : decision === 'accepted' ? t('quoteApproval.submitAccept') : t('quoteApproval.submitReject')}</button>
        </form>
        <p className={styles.legalNote}>{t('quoteApproval.identityNote')}</p>
      </section>}
    </>}
  </main>
}
