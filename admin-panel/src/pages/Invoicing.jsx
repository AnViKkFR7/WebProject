import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDocumentNavigation } from '../hooks/useDocumentNavigation'
import DocumentEditorPage from '../components/DocumentEditorPage'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { usePermissions } from '../hooks/usePermissions'
import { loadInvoicing, saveInvoice, saveProfile, convertQuote } from '../services/invoicingService'
import { emptyProfile, invoiceTotals, newLine, validInvoice, validBillingProfile, hasBillingProfile, usesCompanyIssuer, documentStatuses } from '../lib/invoicing'
import { toLocalInputValue } from '../lib/dates'
import BillingDocumentForm from '../components/BillingDocumentForm'
import { downloadInvoice } from '../lib/invoicingPdf'
import BillingField from '../components/BillingField'
import PageHeader from '../components/ui/PageHeader'
import FormSection from '../components/ui/FormSection'
import Modal from '../components/ui/Modal'
import Icon from '../components/ui/Icon'
import DocumentAppearance from '../components/DocumentAppearance'
import DocumentTotalsBar from '../components/DocumentTotalsBar'
import DocumentActionButton from '../components/ui/DocumentActionButton'
import { withBillingAppearance } from '../lib/billingAppearance'
import '../styles/invoicing.css'


export default function Invoicing({ kind = 'invoice' }) {
  const { selectedCompany, user } = useCompany()
  const { t, language } = useLanguage()
  if (!selectedCompany) return <div className="page-content">{t('dashboard.selectCompanyDescription')}</div>
  return <InvoiceWorkspace key={`${user?.id}-${selectedCompany.id}-${kind}`} kind={kind} company={selectedCompany} t={t} language={language} />
}

function InvoiceWorkspace({ company, t, language, kind }) {
  const { canEdit } = usePermissions()
  const { toast, confirm } = useFeedback()
  const [invoices, setInvoices] = useState([])
  const [profile, setProfile] = useState({ ...emptyProfile, name: company.name })
  const [profileVersion, setProfileVersion] = useState(0)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const [profileDraft, setProfileDraft] = useState(null)
  const [state, setState] = useState('loading')
  const [reload, setReload] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const status = searchParams.get('status') || 'all'
  const changeFilter = (key, value) => setSearchParams(previous => {
    const next = new URLSearchParams(previous)
    if (!value || value === 'all') next.delete(key); else next.set(key,value)
    return next
  }, { replace:true })
  const [editor, setEditor] = useState(null)
  const initialEditor = useRef('')
  const openedRoute = useRef(null)
  const listScroll = useRef(0)
  const errorRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [logoBusy,setLogoBusy] = useState(false)
  const [error, setError] = useState('')
  const isQuote = kind === 'quote'
  const dirty = Boolean(editor && JSON.stringify({doc:editor.doc,status:editor.status}) !== initialEditor.current)
  const { routeId, location, go } = useDocumentNavigation({ dirty, saving:saving || logoBusy, confirm, t, base:isQuote ? '/quotes' : '/invoicing' })
  const previewInvoice = useMemo(() => editor ? ({ document:editor.doc,number:editor.invoice?.number || (isQuote ? 'P-BORRADOR' : 'F-BORRADOR'),status:dirty || !editor.invoice ? 'draft' : editor.status }) : null,[editor,dirty,isQuote])
  const statuses = documentStatuses(kind)
  const label = key => {
    const quoteKey = `quotes.${key}`
    return isQuote && t(quoteKey) !== quoteKey ? t(quoteKey) : t(`invoicing.${key}`)
  }
  const hasSavedIssuer = hasBillingProfile(profile)
  const money = value => new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(value)
  useEffect(() => {
    let active = true
    loadInvoicing(company.id, kind).then(data => {
      if (!active) return
      setInvoices(data.invoices)
      setProfileVersion(data.profileVersion)
      if (data.profile) setProfile({ ...emptyProfile, ...data.profile })
      setState('ready')
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [company.id, kind, reload])

  const field = (key, value, onChange, options = {}) => <BillingField key={key} name={key} label={label(key)} value={value} onChange={onChange} options={options}/>
  const profileFields = (value, change, disabled = false, fields = ['name','taxId','address','email','phone','iban','payment','notes']) => <div className="invoice-fields">
    {fields.map(key => field(key, value[key], v => change({ ...value, [key]: v }), { disabled, required: ['name','taxId','address'].includes(key), type: key === 'email' ? 'email' : 'text', maxLength: 1000 }))}
  </div>
  const start = invoice => {
    listScroll.current = window.scrollY
    go(invoice ? `/${encodeURIComponent(invoice.id)}` : '/new', { state:{ listScroll:listScroll.current, company:company.id } })
  }
  useEffect(() => {
    if (state !== 'ready' || openedRoute.current === routeId) return
    const previousRoute = openedRoute.current
    openedRoute.current = routeId
    setError('')
    if (!routeId) {
      setEditor(null)
      if (previousRoute) document.querySelector('.invoice-toolbar input')?.focus({ preventScroll:true })
      window.scrollTo?.(0,listScroll.current)
      return
    }
    const invoice = routeId === 'new' ? null : invoices.find(record => record.id === routeId)
    if ((routeId !== 'new' && !invoice) || (routeId === 'new' && !canEdit)) { setEditor(null); return }
    const next = invoice ? {
      invoice, doc: structuredClone(invoice.document), status: invoice.status,
      useCompanyIssuer: usesCompanyIssuer(invoice.document.issuer, profile),
      customIssuer: structuredClone(invoice.document.issuer),
    } : {
      useCompanyIssuer: hasSavedIssuer, customIssuer: structuredClone(profile),
      invoice: null, status: 'draft', doc: {
        issuer: structuredClone(profile), customer: { name: '', taxId: '', address: '', email: '' },
        date: toLocalInputValue(new Date()).slice(0,10), dueDate: '', lines: [{...newLine(),...(isQuote ? {chapter:'01 · '+t('quoteEditor.general')} : {})}], withholding: 0,
        payment: profile.payment, iban: profile.iban, notes: profile.notes,
      },
    }
    initialEditor.current = JSON.stringify({doc:next.doc,status:next.status})
    setEditor(next)
    listScroll.current = location.state?.company === company.id ? location.state.listScroll || 0 : listScroll.current
    window.scrollTo?.(0,0)
  }, [routeId,state,invoices,profile,hasSavedIssuer,isQuote,t,canEdit,location.state,company.id])
  const updateDoc = patch => setEditor(prev => ({ ...prev, doc: { ...prev.doc, ...patch } }))
  const persist = async event => {
    event.preventDefault()
    if (!canEdit || saving || logoBusy) return
    const invalid = [...event.currentTarget.elements].filter(input => input.willValidate && !input.validity.valid)
    invalid.forEach(input => input.reportValidity())
    if (invalid.length || !validInvoice(editor.doc)) {
      setError(label('invalid'))
      const target = invalid[0] || errorRef.current
      target?.focus(); target?.scrollIntoView?.({ block:'center' })
      return
    }
    setSaving(true); setError('')
    try {
      const saved = await saveInvoice(company.id, editor.doc, editor.status, editor.invoice, kind)
      if (!active.current) return
      setInvoices(prev => [saved, ...prev.filter(i => i.id !== saved.id)])
      setEditor(null); go('',{completed:true}); toast.success(label('saved'))
    } catch { if (active.current) setError(label('saveError')) } finally { if (active.current) setSaving(false) }
  }
  const cancel = async invoice => {
    if (!await confirm({ title: label('cancelTitle'), message: label('cancelMessage'), confirmLabel: label('cancelInvoice'), danger: true })) return
    if (!active.current || !canEdit || saving) return
    setSaving(true)
    try {
      const saved = await saveInvoice(company.id, invoice.document, 'cancelled', invoice, kind)
      if (!active.current) return
      setInvoices(prev => prev.map(i => i.id === saved.id ? saved : i)); setEditor(null); go('',{completed:true})
    } catch { if (active.current) toast.error(label('saveError')) } finally { setSaving(false) }
  }
  const download = invoice => {
    try { if (active.current) downloadInvoice(invoice,t,language,kind) }
    catch (error) { console.error('PDF generation failed',error); if (active.current) toast.error(t('quoteEditor.downloadError')) }
  }
  const saveIssuer = async event => {
    const inputs = event.currentTarget.closest('section').querySelectorAll('input')
    if (![...inputs].every(input => input.reportValidity()) || !validBillingProfile(editor.doc.issuer)) {
      setError(label('invalid')); return
    }
    if (!canEdit || saving || logoBusy) return
    const nextProfile = withBillingAppearance({ ...profile, ...editor.doc.issuer, prefix: profile.prefix, quotePrefix: profile.quotePrefix || 'P' },profile)
    setSaving(true); setError('')
    try {
      const version = await saveProfile(company.id,nextProfile,profileVersion)
      if (!active.current) return
      setProfileVersion(version)
      setProfile(nextProfile)
      setEditor(prev => ({ ...prev,useCompanyIssuer:true,customIssuer:structuredClone(nextProfile),doc:{ ...prev.doc,issuer:withBillingAppearance(structuredClone(nextProfile),prev.doc.issuer) } }))
      toast.success(label('saved'))
    } catch { if (active.current) setError(label('saveError')) } finally { if (active.current) setSaving(false) }
  }
  const convert = async quote => {
    if (!canEdit || saving || logoBusy) return
    if (!await confirm({ title:label('convertTitle'),message:label('convertMessage'),confirmLabel:label('convert') })) return
    if (!active.current) return
    setSaving(true)
    try {
      const saved = await convertQuote(company.id,quote)
      if (!active.current) return
      setInvoices(prev => prev.map(i => i.id === saved.id ? saved : i)); setEditor(null); go('',{completed:true})
      toast.success(label('converted'))
    } catch { if (active.current) toast.error(label('saveError')) } finally { setSaving(false) }
  }
  const updateIssuer = change => setEditor(previous=>({...previous,doc:{...previous.doc,issuer:typeof change==='function' ? change(previous.doc.issuer) : change}}))
  const saveAppearanceDefault = async () => {
    if (!canEdit || saving || logoBusy) return
    const nextProfile=withBillingAppearance(profile,editor.doc.issuer)
    if (!validBillingProfile(nextProfile)) { toast.error(label('invalid'));return }
    setSaving(true)
    try {
      const version=await saveProfile(company.id,nextProfile,profileVersion)
      if (!active.current) return
      setProfileVersion(version);setProfile(nextProfile);toast.success(t('billingAppearance.defaultSaved'))
    } catch { if(active.current) toast.error(label('saveError')) }
    finally { if(active.current) setSaving(false) }
  }
  const visible = invoices.filter(i => (status === 'all' || i.status === status) &&
    [i.number, i.document.customer.name, i.document.customer.taxId, ...i.document.lines.map(l => l.description)].join(' ').toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)))
  const totals = editor ? invoiceTotals(editor.doc.lines, editor.doc.withholding) : null
  const hasUnsavedChanges = Boolean(editor?.invoice && (JSON.stringify(editor.doc) !== JSON.stringify(editor.invoice.document) || editor.status !== editor.invoice.status))
  const locked = !canEdit || ['cancelled', 'invoiced'].includes(editor?.invoice?.status || editor?.status)

  return <div className="page-content page-content-wide">
    {!routeId && <>
    <PageHeader title={label('title')} description={label('description')} actions={<>
      <button className="ghost-button" disabled={state !== 'ready'} onClick={() => { setError(''); setProfileDraft(structuredClone(profile)) }}>{label('settings')}</button>
      {canEdit && <button className="primary-button" disabled={state !== 'ready'} onClick={() => start(null)}><Icon name="plus" size={16}/>{label('new')}</button>}
    </>} />
    {state === 'loading' && <p role="status">{t('common.loading')}</p>}
    {state === 'error' && <div className="error-state" role="alert">{label('loadError')}<button onClick={() => { setState('loading'); setReload(k => k + 1) }}>{label('retry')}</button></div>}
    {state === 'ready' && <>
      <div className="invoice-stats">{(isQuote ? [['accepted','acceptedTotal'],['sent','pendingTotal'],['draft','draftTotal']] : [['issued','outstanding'],['paid','paidTotal'],['draft','draftTotal']]).map(([value,key]) => <div className="card" key={key}><span>{label(key)}</span><strong>{money(invoices.filter(i => i.status === value).reduce((sum,i) => sum + invoiceTotals(i.document.lines,i.document.withholding).total,0))}</strong></div>)}</div>
      <div className="invoice-toolbar"><input type="search" className="input" aria-label={label('search')} placeholder={label('search')} value={query} onChange={e => changeFilter('q',e.target.value)}/><select className="select" aria-label={label('status')} value={status} onChange={e => changeFilter('status',e.target.value)}>{['all', ...statuses].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></div>
      <div className="card invoice-list">{!visible.length ? <p>{label('empty')}</p> : <div className="invoice-table-scroll"><table className="invoice-table"><thead><tr>{['number','customer','date','total','status'].map(k => <th key={k}>{label(k)}</th>)}<th>{t('common.actions')}</th></tr></thead><tbody>{visible.map(i => <tr key={i.id}>
        <td><button className="ghost-button" onClick={() => start(i)}>{i.number}</button></td><td>{i.document.customer.name}</td><td>{i.document.date}</td><td>{money(invoiceTotals(i.document.lines,i.document.withholding).total)}</td><td><span className={`invoice-status invoice-status-${i.status}`}>{label(i.status)}</span></td><td><button className="ghost-button" aria-label={`${label('download')} ${i.number}`} onClick={() => download(i)}><Icon name="download" size={16}/></button></td>
      </tr>)}</tbody></table></div>}</div>
    </>}
    </>}
    {routeId && state === 'loading' && <p role="status">{t('common.loading')}</p>}
    {routeId && state === 'error' && <div role="alert">{label('loadError')}<button className="ghost-button" onClick={() => { setState('loading');setReload(value=>value+1) }}>{label('retry')}</button></div>}
    {routeId && state === 'ready' && !editor && <div className="card" role="status">{t('documentWorkspace.unavailable')}<button className="ghost-button" onClick={() => go('')}>{t('documentWorkspace.back')}</button></div>}
    <Modal open={!!profileDraft} size="lg" className="brand-settings-modal" icon="companies" eyebrow={t('formDesign.brandEyebrow')} description={t('formDesign.brandHelp')} title={label('settings')} onClose={() => { if (!saving && !logoBusy) setProfileDraft(null) }} footer={canEdit && <button form="invoice-profile" type="submit" className="primary-button" disabled={saving || logoBusy}>{t(saving ? 'common.savingChanges' : 'common.save')}</button>}>
      {profileDraft && <form id="invoice-profile" onSubmit={async e => {
        e.preventDefault(); if (!canEdit || saving || logoBusy) return; if (!validBillingProfile(profileDraft)) { setError(label('invalid')); return }; setSaving(true); setError('')
        try { const version = await saveProfile(company.id,profileDraft,profileVersion); if (!active.current) return; setProfileVersion(version); setProfile(profileDraft); setProfileDraft(null); toast.success(label('saved')) }
        catch { setError(label('saveError')) } finally { setSaving(false) }
      }}>
        <p className="form-note"><Icon name="info" size={16}/>{label('settingsHelp')}</p>
        <fieldset disabled={!canEdit || saving || logoBusy} className="invoice-fieldset brand-settings-grid">
          <div className="form-column">
            <FormSection icon="companies" title={t('formDesign.businessIdentity')} step="01">
              {profileFields(profileDraft,setProfileDraft,false,['name','taxId','address','email','phone'])}
            </FormSection>
            <FormSection icon="file" title={t('formDesign.paymentDetails')} tone="teal" step="02">
              {profileFields(profileDraft,setProfileDraft,false,['iban','payment','notes'])}
            </FormSection>
          </div>
          <FormSection icon="image" title={t('formDesign.brandAppearance')} tone="amber" step="03">
            <div className="invoice-fields">{field(isQuote ? 'quotePrefix' : 'prefix',isQuote ? (profileDraft.quotePrefix || 'P') : profileDraft.prefix,v => setProfileDraft(p => ({ ...p,[isQuote ? 'quotePrefix' : 'prefix']:v })),{ required:true,maxLength:20,pattern:'[A-Za-z0-9_-]+' })}</div>
            <DocumentAppearance profile={profileDraft} onChange={setProfileDraft} disabled={!canEdit || saving} onBusyChange={setLogoBusy}/>
          </FormSection>
        </fieldset>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>}
    </Modal>
    {editor && routeId && <DocumentEditorPage key={routeId} title={editor.invoice?.number || label('new')} company={company.name} status={label(editor.status)} dirty={dirty} saving={saving || logoBusy} locked={locked} onBack={() => go('')} invoice={previewInvoice} t={t} language={language} kind={kind} summary={<DocumentTotalsBar totals={totals} label={label} money={money} t={t}/>} actions={<>
      <DocumentActionButton variant="outline" disabled={saving || logoBusy} onClick={()=>{setError('');setProfileDraft(structuredClone(profile))}}><Icon name="companies" size={16}/>{label('settings')}</DocumentActionButton>
      {editor && <DocumentActionButton disabled={saving || logoBusy || !validInvoice(editor.doc)} onClick={() => download({ ...editor.invoice,document:editor.doc,number:editor.invoice?.number || (isQuote ? 'P-BORRADOR' : 'F-BORRADOR'),status:hasUnsavedChanges || !editor.invoice ? 'draft' : editor.status })}><Icon name="download" size={16}/>{label('download')}</DocumentActionButton>}
      {isQuote && canEdit && editor?.invoice?.status === 'accepted' && <button className="primary-button" disabled={saving || logoBusy || hasUnsavedChanges} onClick={() => convert(editor.invoice)}>{label('convert')}</button>}
      {editor?.invoice && !locked && <DocumentActionButton variant="danger" disabled={saving || logoBusy} onClick={() => cancel(editor.invoice)}><Icon name="close" size={16}/>{label('cancelInvoice')}</DocumentActionButton>}
      {!locked && <button type="submit" form="invoice-editor" className="primary-button" disabled={saving || logoBusy}><Icon name="save" size={16}/>{t(saving ? 'common.savingChanges' : 'common.save')}</button>}    </>}>
      {hasUnsavedChanges && <p className="field-help" role="status">{label('saveBeforeAction')}</p>}
      <BillingDocumentForm editor={editor} company={company} profile={profile} hasSavedIssuer={hasSavedIssuer} locked={locked} canEdit={canEdit} saving={saving} isQuote={isQuote} field={field} profileFields={profileFields} updateDoc={updateDoc} setEditor={setEditor} saveIssuer={saveIssuer} persist={persist} statuses={statuses} label={label} t={t} money={money} error={error} errorRef={errorRef} appearance={<details className="document-appearance-details">
        <summary><Icon name="image" size={18}/><span>{t('billingAppearance.documentTitle')}</span><span>{t('billingAppearance.personalize')}</span></summary>
        <p className="field-help">{t('billingAppearance.documentHelp')}</p>
        <DocumentAppearance profile={editor.doc.issuer} onChange={updateIssuer} disabled={locked || saving} onBusyChange={setLogoBusy}/>
        {!locked && <div className="document-appearance-actions"><DocumentActionButton variant="outline" disabled={saving || logoBusy} onClick={()=>updateIssuer(previous=>withBillingAppearance(previous,profile))}>{t('billingAppearance.reset')}</DocumentActionButton>
        <DocumentActionButton disabled={saving || logoBusy || !validBillingProfile(withBillingAppearance(profile,editor.doc.issuer))} onClick={saveAppearanceDefault}>{t('billingAppearance.saveDefault')}</DocumentActionButton></div>}
        {!hasSavedIssuer && <p className="field-help">{t('billingAppearance.needsIssuer')}</p>}
      </details>}/>

    </DocumentEditorPage>}
  </div>
}
