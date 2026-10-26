import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDocumentNavigation } from '../hooks/useDocumentNavigation'
import { useBillingPaletteLibrary } from '../hooks/useBillingPaletteLibrary'
import DocumentEditorPage from '../components/DocumentEditorPage'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { usePermissions } from '../hooks/usePermissions'
import { loadInvoicing, saveInvoice, saveProfile, convertQuote, rectifyInvoice } from '../services/invoicingService'
import { emptyProfile, invoiceTotals, newLine, validInvoice, validBillingProfile, hasBillingProfile, usesCompanyIssuer, documentStatuses, createRectificationDocument } from '../lib/invoicing'
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
import DocumentDraftRecovery from '../components/DocumentDraftRecovery'
import { draftFingerprint } from '../lib/documentDrafts'
import { reportOperationalFailure } from '../lib/operationalTelemetry'
import {archiveBillingCatalogItem,loadBillingReuse,saveBillingClient,saveBillingCatalogItem} from '../services/billingReuseService'
import {archiveBillingChapterTemplate,loadBillingChapterTemplates,saveBillingChapterTemplate} from '../services/billingTemplateService'
import {applyChapterTemplate,billingLineId,duplicateBillingDocument,withBillingLineIds} from '../lib/billingTemplates'
import {loadBillingFinanceDetail,loadBillingHistoryPage,loadInvoiceFinancials,registerInvoicePayment,restoreBillingDraftVersion,reverseInvoicePayment,loadInvoiceDueReminderPreference,setInvoiceDueReminders} from '../services/billingFinanceService'
import BillingFinancePanel from '../components/BillingFinancePanel'
import BillingDueReminderSettings from '../components/BillingDueReminderSettings'
import { createQuoteApprovalToken, quoteApprovalService } from '../services/quoteApprovalService'
import approvalStyles from './QuoteApprovalPanel.module.css'
import '../styles/invoicing.css'


export default function Invoicing({ kind = 'invoice' }) {
  const { selectedCompany, user } = useCompany()
  const { t, language } = useLanguage()
  if (!selectedCompany) return <div className="page-content">{t('dashboard.selectCompanyDescription')}</div>
  return <InvoiceWorkspace key={`${user?.id}-${selectedCompany.id}-${kind}`} userId={user?.id} kind={kind} company={selectedCompany} t={t} language={language} />
}

function InvoiceWorkspace({ company, userId, t, language, kind }) {
  const { canEdit,canManageModules } = usePermissions()
  const paletteLibrary=useBillingPaletteLibrary(company.id,canEdit)
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
  const paymentFilter=searchParams.get('payment') || 'all'
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
  const draftRef=useRef(null)
  const [protectedDraft,setProtectedDraft]=useState('')
  const [draftGate,setDraftGate]=useState(false)
  const [reuse,setReuse]=useState({clients:[],catalog:[],loading:true,error:false})
  const [reuseReload,setReuseReload]=useState(0)
  const [templates,setTemplates]=useState({items:[],loading:kind==='quote',error:false})
  const [templateReload,setTemplateReload]=useState(0)
  const [finance,setFinance]=useState({items:[],loading:kind==='invoice',error:false})
  const [financeDetail,setFinanceDetail]=useState({payments:[],history:[],historyHasMore:false,loading:false,loadingMore:false,error:false})
  const [financeReload,setFinanceReload]=useState(0)
  const [reminderPreference,setReminderPreference]=useState({suppressed:false,loading:false,saving:false,error:false})
  const [quoteApproval,setQuoteApproval]=useState({ quoteId:'',url:'',expiresAt:'',loading:false,emailLoading:false,error:false,auditError:false,audit:null,emailSent:false,emailError:false })
  const [sendApprovalEmail,setSendApprovalEmail]=useState(false)
  const isQuote = kind === 'quote'
  const editorRecordId=editor?.invoice?.id
  const reminderInvoiceStatus=editor?.invoice?.status
  useEffect(()=>{
    let current=true
    setReuse(previous=>({...previous,loading:true,error:false}))
    loadBillingReuse(company.id).then(data=>{if(current)setReuse({...data,loading:false,error:false})}).catch(()=>{if(current)setReuse(previous=>({...previous,loading:false,error:true}))})
    return()=>{current=false}
  },[company.id,reuseReload])
  useEffect(()=>{
    if(!isQuote){setTemplates({items:[],loading:false,error:false});return}
    let current=true;setTemplates(previous=>({...previous,loading:true,error:false}))
    loadBillingChapterTemplates(company.id).then(items=>{if(current)setTemplates({items,loading:false,error:false})}).catch(()=>{if(current)setTemplates(previous=>({...previous,loading:false,error:true}))})
    return()=>{current=false}
  },[company.id,isQuote,templateReload])
  useEffect(()=>{
    if(isQuote){setFinance({items:[],loading:false,error:false});return}
    let current=true;setFinance(previous=>({...previous,loading:true,error:false}))
    loadInvoiceFinancials(company.id).then(items=>{if(current)setFinance({items,loading:false,error:false})}).catch(()=>{if(current)setFinance(previous=>({...previous,loading:false,error:true}))})
    return()=>{current=false}
  },[company.id,isQuote,financeReload])
  useEffect(()=>{
    if(!editorRecordId){setFinanceDetail({payments:[],history:[],historyHasMore:false,loading:false,loadingMore:false,error:false});return}
    let current=true;setFinanceDetail(previous=>({...previous,loading:true,error:false}))
    loadBillingFinanceDetail(company.id,kind,editorRecordId).then(value=>{if(current)setFinanceDetail({...value,loading:false,error:false})}).catch(()=>{if(current)setFinanceDetail(previous=>({...previous,loading:false,error:true}))})
    return()=>{current=false}
  },[company.id,kind,editorRecordId,financeReload])
  useEffect(()=>{
    if(isQuote||!editorRecordId||reminderInvoiceStatus!=='issued'){setReminderPreference({suppressed:false,loading:false,saving:false,error:false});return}
    let current=true;setReminderPreference({suppressed:false,loading:true,saving:false,error:false})
    loadInvoiceDueReminderPreference(company.id,editorRecordId).then(value=>{if(current)setReminderPreference({suppressed:value.suppressed,loading:false,saving:false,error:false})}).catch(()=>{if(current)setReminderPreference({suppressed:false,loading:false,saving:false,error:true})})
    return()=>{current=false}
  },[company.id,isQuote,editorRecordId,reminderInvoiceStatus])
  useEffect(()=>{
    if (!isQuote || !editorRecordId || !canEdit) { setQuoteApproval({quoteId:'',url:'',expiresAt:'',loading:false,error:false,auditError:false,audit:null}); return }
    let current=true
    setQuoteApproval({quoteId:editorRecordId,url:'',expiresAt:'',loading:false,error:false,auditError:false,audit:null})
    const refresh=async()=>{
      try {
        const audit=await quoteApprovalService.audit(company.id,editorRecordId)
        if(!current)return
        setQuoteApproval(previous=>({...previous,audit,error:false,auditError:false}))
        if(audit.quote_status){
          setInvoices(previous=>previous.map(item=>item.id===editorRecordId?{...item,status:audit.quote_status,version:audit.quote_version??item.version}:item))
          setEditor(previous=>{
            if(!previous?.invoice||previous.invoice.id!==editorRecordId)return previous
            const changed=JSON.stringify({doc:previous.doc,status:previous.status})!==initialEditor.current
            if(changed)return previous
            const updated={...previous,status:audit.quote_status,invoice:{...previous.invoice,status:audit.quote_status,version:audit.quote_version??previous.invoice.version}}
            initialEditor.current=JSON.stringify({doc:updated.doc,status:updated.status})
            return updated
          })
        }
      } catch {if(current)setQuoteApproval(previous=>({...previous,auditError:true}))}
    }
    void refresh()
    const interval=window.setInterval(()=>void refresh(),8000)
    return()=>{current=false;window.clearInterval(interval)}
  },[company.id,isQuote,editorRecordId,canEdit])
  const createReuseClient=async value=>{const created=await saveBillingClient(company.id,value);setReuse(previous=>({...previous,clients:[created,...previous.clients]}));return created}
  const createReuseItem=async value=>{const created=await saveBillingCatalogItem(company.id,value);setReuse(previous=>({...previous,catalog:[created,...previous.catalog]}));return created}
  const archiveReuseItem=async item=>{
    if(!await confirm({title:t('billingReuse.catalog.archiveTitle'),message:t('billingReuse.catalog.archiveHelp'),confirmLabel:t('billingReuse.catalog.archive'),danger:true}))return
    try {
      await archiveBillingCatalogItem(company.id,item.id)
      if(active.current)setReuse(previous=>({...previous,catalog:previous.catalog.filter(entry=>entry.id!==item.id)}))
    } catch {
      if(active.current)toast.error(t('billingReuse.catalog.archiveError'))
    }
  }
  const saveTemplate=async value=>{const created=await saveBillingChapterTemplate(company.id,value);if(active.current)setTemplates(previous=>({...previous,items:[created,...previous.items]}));return created}
  const applyTemplate=template=>setEditor(previous=>({...previous,doc:{...previous.doc,lines:applyChapterTemplate(previous.doc.lines,template.lines)}}))
  const archiveTemplate=async template=>{
    if(!await confirm({title:t('chapterTemplates.archiveTitle'),message:t('chapterTemplates.archiveHelp'),confirmLabel:t('chapterTemplates.archive'),danger:true}))return
    try{await archiveBillingChapterTemplate(company.id,template.id);if(active.current)setTemplates(previous=>({...previous,items:previous.items.filter(item=>item.id!==template.id)}))}
    catch{if(active.current)toast.error(t('chapterTemplates.archiveError'))}
  }
  const updateFinanceInvoice=result=>setEditor(previous=>{if(!previous)return previous;initialEditor.current=JSON.stringify({doc:previous.doc,status:result.invoice_status});return{...previous,status:result.invoice_status,invoice:{...previous.invoice,status:result.invoice_status,version:result.invoice_version}}})
  const registerPayment=async value=>{const result=await registerInvoicePayment(company.id,editor.invoice,value);if(!active.current)return;updateFinanceInvoice(result);setInvoices(previous=>previous.map(item=>item.id===editor.invoice.id?{...item,status:result.invoice_status,version:result.invoice_version}:item));setFinanceReload(value=>value+1)}
  const reversePayment=async(payment,reason)=>{const result=await reverseInvoicePayment(company.id,payment,reason);if(!active.current)return;updateFinanceInvoice(result);setInvoices(previous=>previous.map(item=>item.id===editor.invoice.id?{...item,status:result.invoice_status,version:result.invoice_version}:item));setFinanceReload(value=>value+1)}
  const restoreVersion=async event=>{const saved=await restoreBillingDraftVersion(company.id,kind,editor.invoice,event);if(!active.current)return;setInvoices(previous=>previous.map(item=>item.id===saved.id?saved:item));setEditor(previous=>({...previous,invoice:saved,doc:structuredClone(saved.document),status:saved.status}));initialEditor.current=JSON.stringify({doc:saved.document,status:saved.status});setFinanceReload(value=>value+1)}
  const loadMoreHistory=async()=>{if(!editor?.invoice||financeDetail.loadingMore)return;setFinanceDetail(previous=>({...previous,loadingMore:true}));try{const page=await loadBillingHistoryPage(company.id,kind,editor.invoice.id,financeDetail.history.length);if(!active.current)return;setFinanceDetail(previous=>({...previous,history:[...previous.history,...page.history],historyHasMore:page.historyHasMore,loadingMore:false}))}catch{if(active.current)setFinanceDetail(previous=>({...previous,loadingMore:false,error:true}))}}
  const dirty = Boolean(editor && JSON.stringify({doc:editor.doc,status:editor.status}) !== initialEditor.current)
  const draftProtected=Boolean(editor && editor.status==='draft' && protectedDraft===draftFingerprint(editor.doc))
  const { routeId, location, go } = useDocumentNavigation({ dirty:dirty && !draftProtected, saving:saving || logoBusy, confirm, t, base:isQuote ? '/quotes' : '/invoicing',leaveMessage:canEdit && editor && (!editor.invoice || editor.invoice.status==='draft') ? t('documentAutosave.leaveMessage') : undefined })
  const previewInvoice = useMemo(() => editor ? ({ document:editor.doc,number:editor.invoice?.number || (editor.rectificationSource ? `${profile.rectificationPrefix || 'FR'}-BORRADOR` : isQuote ? 'P-BORRADOR' : 'F-BORRADOR'),status:dirty || !editor.invoice ? 'draft' : editor.status }) : null,[editor,dirty,isQuote,profile.rectificationPrefix])
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
  const startDuplicate=invoice=>{
    listScroll.current=window.scrollY
    go('/new',{state:{listScroll:listScroll.current,company:company.id,duplicateSource:invoice.number,duplicateDocument:duplicateBillingDocument(invoice.document)}})
  }
  const startRectification=invoice=>go(`/rectify/${encodeURIComponent(invoice.id)}`,{state:{company:company.id}})
  const issueQuoteApproval = async (quote,sendEmail=false) => {
    if (!canEdit || quote?.status !== 'sent' || hasUnsavedChanges) return
    setQuoteApproval(previous=>({...previous,loading:true,error:false}))
    try {
      const token=createQuoteApprovalToken()
      const result=await quoteApprovalService.issue(company.id,quote.id,token,30)
      setQuoteApproval(previous=>({...previous,quoteId:quote.id,url:result.url,expiresAt:result.expiresAt,loading:false,error:false,auditError:false,emailSent:false,emailWarning:false,emailError:false}))
      if(sendEmail){
        setQuoteApproval(previous=>({...previous,emailLoading:true}))
        try{const delivery=await quoteApprovalService.emailLink(company.id,quote.id,token);setQuoteApproval(previous=>({...previous,emailLoading:false,emailSent:true,emailWarning:Boolean(delivery.warning),emailError:false}))}
        catch{setQuoteApproval(previous=>({...previous,emailLoading:false,emailError:true}))}
      }
      try {
        const audit=await quoteApprovalService.audit(company.id,quote.id)
        setQuoteApproval(previous=>({...previous,audit,auditError:false}))
      } catch { setQuoteApproval(previous=>({...previous,auditError:true})) }
    } catch {
      setQuoteApproval(previous=>({...previous,loading:false,error:true}))
    }
  }
  const copyQuoteApprovalLink = async () => {
    try { await navigator.clipboard.writeText(quoteApproval.url); toast.success(t('quoteApproval.linkCopied')) }
    catch { toast.error(t('quoteApproval.copyError')) }
  }
  useEffect(() => {
    if (state !== 'ready' || openedRoute.current === routeId) return
    const previousRoute = openedRoute.current
    openedRoute.current = routeId
    setError('')
    setProtectedDraft('');setDraftGate(false)
    if (!routeId) {
      setEditor(null)
      if (previousRoute) document.querySelector('.invoice-toolbar input')?.focus({ preventScroll:true })
      window.scrollTo?.(0,listScroll.current)
      return
    }
    const rectificationId=routeId.startsWith('rectify/') ? decodeURIComponent(routeId.slice('rectify/'.length)) : null
    const rectificationSource=rectificationId ? invoices.find(record=>record.id===rectificationId) : null
    const invoice = routeId === 'new' || rectificationId ? null : invoices.find(record => record.id === routeId)
    if ((routeId !== 'new' && !rectificationId && !invoice) || (routeId === 'new' && !canEdit) || (rectificationId && (!canEdit || isQuote || !rectificationSource || !['issued','paid'].includes(rectificationSource.status)))) { setEditor(null); return }
    if(rectificationId && rectificationSource) {
      const method=location.state?.method || 'difference'
      const cause=location.state?.cause || 'other'
      const note=location.state?.note || ''
      const next={invoice:null,status:'issued',rectificationSource,rectificationRequest:crypto.randomUUID(),useCompanyIssuer:usesCompanyIssuer(rectificationSource.document.issuer,profile),customIssuer:structuredClone(rectificationSource.document.issuer),doc:createRectificationDocument(rectificationSource,method,cause,note,toLocalInputValue(new Date()).slice(0,10))}
      initialEditor.current=JSON.stringify({doc:next.doc,status:next.status});setEditor(next);window.scrollTo?.(0,0);return
    }
    const duplicate=routeId==='new' && location.state?.company===company.id && location.state?.duplicateDocument
    const next = invoice ? {
      invoice, doc: isQuote ? {...structuredClone(invoice.document),lines:withBillingLineIds(invoice.document.lines)} : structuredClone(invoice.document), status: invoice.status,
      useCompanyIssuer: usesCompanyIssuer(invoice.document.issuer, profile),
      customIssuer: structuredClone(invoice.document.issuer),
    } : duplicate ? {
      useCompanyIssuer:usesCompanyIssuer(duplicate.issuer,profile),customIssuer:structuredClone(duplicate.issuer),invoice:null,status:'draft',duplicateSource:location.state.duplicateSource,
      doc:{...structuredClone(duplicate),lines:isQuote ? withBillingLineIds(duplicate.lines) : duplicate.lines},
    } : {
      useCompanyIssuer: hasSavedIssuer, customIssuer: structuredClone(profile),
      invoice: null, status: 'draft', doc: {
        issuer: structuredClone(profile), customer: { name: '', taxId: '', address: '', email: '' },
        date: toLocalInputValue(new Date()).slice(0,10), dueDate: '', lines: [{...newLine(),...(isQuote ? {id:billingLineId(),chapter:'01 · '+t('quoteEditor.general')} : {})}], withholding: 0,
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
      const recovery=await draftRef.current?.prepare(editor.doc)
      if(!active.current)return
      const saved = editor.rectificationSource
        ? await rectifyInvoice(company.id,editor.rectificationSource,editor.doc,editor.rectificationRequest)
        : await saveInvoice(company.id, editor.doc, editor.status, editor.invoice, kind,recovery)
      if (!active.current) return
      draftRef.current?.complete()
      setInvoices(prev => [saved, ...prev.filter(i => i.id !== saved.id)])
      const savedDoc = isQuote ? { ...structuredClone(saved.document), lines:withBillingLineIds(saved.document.lines) } : structuredClone(saved.document)
      const nextEditor = { invoice:saved, doc:savedDoc, status:saved.status, useCompanyIssuer:usesCompanyIssuer(saved.document.issuer,profile), customIssuer:structuredClone(saved.document.issuer) }
      initialEditor.current = JSON.stringify({doc:savedDoc,status:saved.status})
      setEditor(nextEditor)
      if (routeId === 'new' || routeId.startsWith('rectify/')) {
        go(`/${encodeURIComponent(saved.id)}`,{completed:true,state:{listScroll:listScroll.current,company:company.id}})
      }
      toast.success(label('saved'))
    } catch(error) { reportOperationalFailure('billing','document_save_failed',error); if (active.current){draftRef.current?.failed(error);setError(label('saveError'))} } finally { if (active.current) setSaving(false) }
  }
  const cancel = async invoice => {
    if (!await confirm({ title: label('cancelTitle'), message: label('cancelMessage'), confirmLabel: label('cancelInvoice'), danger: true })) return
    if (!active.current || !canEdit || saving) return
    setSaving(true)
    try {
      const saved = await saveInvoice(company.id, invoice.document, 'cancelled', invoice, kind)
      if (!active.current) return
      setInvoices(prev => prev.map(i => i.id === saved.id ? saved : i)); setEditor(null); go('',{completed:true})
    } catch(error) { reportOperationalFailure('billing','document_cancel_failed',error); if (active.current) toast.error(label('saveError')) } finally { setSaving(false) }
  }
  const download = invoice => {
    try { if (active.current) downloadInvoice(invoice,t,language,kind) }
    catch (error) { reportOperationalFailure('billing','pdf_generation_failed',error); if (active.current) toast.error(t('quoteEditor.downloadError')) }
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
    } catch(error) { reportOperationalFailure('billing','billing_profile_save_failed',error); if (active.current) setError(label('saveError')) } finally { if (active.current) setSaving(false) }
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
    } catch(error) { reportOperationalFailure('billing','document_conversion_failed',error); if (active.current) toast.error(label('saveError')) } finally { setSaving(false) }
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
    } catch(error) { reportOperationalFailure('billing','billing_default_save_failed',error); if(active.current) toast.error(label('saveError')) }
    finally { if(active.current) setSaving(false) }
  }
  const financialById=new Map(finance.items.map(item=>[item.invoice_id,item]))
  const changeInvoiceReminderPreference=async suppressed=>{if(!editor?.invoice?.id)return;setReminderPreference(previous=>({...previous,saving:true,error:false}));try{const value=await setInvoiceDueReminders(company.id,editor.invoice.id,suppressed);setReminderPreference({suppressed:value.suppressed,loading:false,saving:false,error:false})}catch{setReminderPreference(previous=>({...previous,saving:false,error:true}))}}
  const visible = invoices.filter(i => (status === 'all' || i.status === status) && (isQuote || paymentFilter==='all' || financialById.get(i.id)?.payment_state===paymentFilter) &&
    [i.number, i.document.customer.name, i.document.customer.taxId, ...i.document.lines.map(l => l.description)].join(' ').toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)))
  const totals = editor ? invoiceTotals(editor.doc.lines, editor.doc.withholding) : null
  const hasUnsavedChanges = Boolean(editor?.invoice && dirty)
  const locked = !canEdit || (!editor?.rectificationSource && ['issued', 'paid', 'cancelled', 'invoiced'].includes(editor?.invoice?.status || editor?.status))
  const stats=isQuote
    ? [['accepted','acceptedTotal'],['sent','pendingTotal'],['draft','draftTotal']].map(([value,key])=>({key,total:invoices.filter(item=>item.status===value).reduce((sum,item)=>sum+invoiceTotals(item.document.lines,item.document.withholding).total,0)}))
    : [
      {key:'outstanding',total:finance.items.reduce((sum,item)=>sum+item.balance,0)},
      {key:'paidTotal',total:finance.items.reduce((sum,item)=>sum+item.paid,0)},
      {key:'draftTotal',total:invoices.filter(item=>item.status==='draft').reduce((sum,item)=>sum+invoiceTotals(item.document.lines,item.document.withholding).total,0)},
    ]

  return <div className="page-content page-content-wide">
    {!routeId && <>
    <PageHeader title={label('title')} description={label('description')} actions={<>
      <button className="ghost-button" disabled={state !== 'ready'} onClick={() => { setError(''); setProfileDraft(structuredClone(profile)) }}>{label('settings')}</button>
      {canEdit && <button className="primary-button" disabled={state !== 'ready'} onClick={() => start(null)}><Icon name="plus" size={16}/>{label('new')}</button>}
    </>} />
    {state === 'loading' && <p role="status">{t('common.loading')}</p>}
    {state === 'error' && <div className="error-state" role="alert">{label('loadError')}<button onClick={() => { setState('loading'); setReload(k => k + 1) }}>{label('retry')}</button></div>}
    {state === 'ready' && <>
      <div className="invoice-stats">{stats.map(item=><div className="card" key={item.key}><span>{label(item.key)}</span><strong>{money(item.total)}</strong></div>)}</div>
      {!isQuote&&<BillingDueReminderSettings companyId={company.id} canManage={canManageModules} canRetry={canEdit} t={t}/>}
      <div className="invoice-toolbar"><input type="search" className="input" aria-label={label('search')} placeholder={label('search')} value={query} onChange={e => changeFilter('q',e.target.value)}/><select className="select" aria-label={label('status')} value={status} onChange={e => changeFilter('status',e.target.value)}>{['all', ...statuses].map(s => <option key={s} value={s}>{label(s)}</option>)}</select>{!isQuote&&<select className="select" aria-label={t('billingFinance.filter')} value={paymentFilter} onChange={event=>changeFilter('payment',event.target.value)}>{['all','overdue','outstanding','partial','paid','credit'].map(value=><option key={value} value={value}>{t(`billingFinance.states.${value}`)}</option>)}</select>}</div>
      {finance.error&&!isQuote&&<p className="field-error" role="alert">{t('billingFinance.loadError')}</p>}
      <div className="card invoice-list">{!visible.length ? <p>{label('empty')}</p> : <div className="invoice-table-scroll" role="region" aria-label={label('title')} tabIndex={0}><table className="invoice-table"><thead><tr>{['number','customer','date','total',...(!isQuote?['balance']:[]),'status'].map(k => <th key={k} scope="col">{k==='balance'?t('billingFinance.balance'):label(k)}</th>)}<th scope="col">{t('common.actions')}</th></tr></thead><tbody>{visible.map(i => <tr key={i.id}>
        <td><button className="ghost-button" onClick={() => start(i)}>{i.number}</button></td><td>{i.document.customer.name}</td><td>{i.document.date}{!isQuote&&financialById.get(i.id)?.due_date&&<small className="invoice-due">{t('billingFinance.due')} {financialById.get(i.id).due_date}</small>}</td><td>{money(invoiceTotals(i.document.lines,i.document.withholding).total)}</td>{!isQuote&&<td>{financialById.has(i.id)?money(financialById.get(i.id).balance):'—'}</td>}<td><span className={`invoice-status invoice-status-${i.status}`}>{label(i.status)}</span>{!isQuote&&financialById.has(i.id)&&<small className="invoice-payment-state">{t(`billingFinance.states.${financialById.get(i.id).payment_state}`)}</small>}</td><td><div className="invoice-row-actions"><button className="ghost-button" aria-label={`${label('download')} ${i.number}`} onClick={() => download(i)}><Icon name="download" size={16}/></button>{canEdit && <button className="ghost-button" aria-label={`${label('duplicate')} ${i.number}`} onClick={()=>startDuplicate(i)}><Icon name="copy" size={16}/></button>}{canEdit&&!isQuote&&['issued','paid'].includes(i.status)&&!i.rectifies_invoice_id&&<button className="ghost-button" aria-label={`${t('rectification.start')} ${i.number}`} title={t('rectification.start')} onClick={()=>startRectification(i)}><Icon name="file" size={16}/></button>}</div></td>
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
        catch(error) { reportOperationalFailure('billing','billing_profile_save_failed',error); setError(label('saveError')) } finally { setSaving(false) }
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
            <div className="invoice-fields">{field(isQuote ? 'quotePrefix' : 'prefix',isQuote ? (profileDraft.quotePrefix || 'P') : profileDraft.prefix,v => setProfileDraft(p => ({ ...p,[isQuote ? 'quotePrefix' : 'prefix']:v })),{ required:true,maxLength:20,pattern:'[A-Za-z0-9_-]+' })}{!isQuote&&field('rectificationPrefix',profileDraft.rectificationPrefix || 'FR',v=>setProfileDraft(p=>({...p,rectificationPrefix:v})),{required:true,maxLength:20,pattern:'[A-Za-z0-9_-]+'})}</div>
            {!isQuote&&<p className="field-help">{t('rectification.seriesHelp')}</p>}
            <DocumentAppearance profile={profileDraft} onChange={setProfileDraft} disabled={!canEdit || saving} onBusyChange={setLogoBusy} paletteLibrary={paletteLibrary}/>
          </FormSection>
        </fieldset>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>}
    </Modal>
    {editor && routeId && <DocumentEditorPage key={routeId} title={editor.invoice?.number || (editor.rectificationSource ? `${t('rectification.documentTitle')} · ${editor.rectificationSource.number}` : label('new'))} company={company.name} status={label(editor.status)} dirty={dirty && !draftProtected} saving={saving || logoBusy} locked={locked} onBack={() => go('')} invoice={previewInvoice} t={t} language={language} kind={kind} summary={<DocumentTotalsBar totals={totals} label={label} money={money} t={t}/>} actions={<>
      <DocumentActionButton variant="outline" disabled={saving || logoBusy} onClick={()=>{setError('');setProfileDraft(structuredClone(profile))}}><Icon name="companies" size={16}/>{label('settings')}</DocumentActionButton>
      {editor && <DocumentActionButton disabled={saving || logoBusy || !validInvoice(editor.doc)} onClick={() => download({ ...editor.invoice,document:editor.doc,number:editor.invoice?.number || (editor.rectificationSource ? `${profile.rectificationPrefix || 'FR'}-BORRADOR` : isQuote ? 'P-BORRADOR' : 'F-BORRADOR'),status:hasUnsavedChanges || !editor.invoice ? 'draft' : editor.status })}><Icon name="download" size={16}/>{label('download')}</DocumentActionButton>}
      {canEdit && editor?.invoice && <DocumentActionButton variant="outline" disabled={saving || logoBusy || hasUnsavedChanges} onClick={()=>startDuplicate(editor.invoice)}><Icon name="copy" size={16}/>{label('duplicate')}</DocumentActionButton>}
      {canEdit && editor?.invoice && !isQuote && ['issued','paid'].includes(editor.invoice.status) && !editor.invoice.rectifies_invoice_id && <DocumentActionButton variant="outline" disabled={saving||hasUnsavedChanges} onClick={()=>startRectification(editor.invoice)}><Icon name="file" size={16}/>{t('rectification.start')}</DocumentActionButton>}
      {isQuote && canEdit && editor?.invoice?.status === 'accepted' && <button className="primary-button" disabled={saving || logoBusy || hasUnsavedChanges} onClick={() => convert(editor.invoice)}>{label('convert')}</button>}
      {editor?.invoice && !locked && (isQuote || editor.invoice.status==='draft') && <DocumentActionButton variant="danger" disabled={saving || logoBusy} onClick={() => cancel(editor.invoice)}><Icon name="close" size={16}/>{label('cancelInvoice')}</DocumentActionButton>}
      {!locked && <button type="submit" form="invoice-editor" className="primary-button" disabled={saving || logoBusy}><Icon name="save" size={16}/>{t(saving ? 'common.savingChanges' : 'common.save')}</button>}    </>}>
      {hasUnsavedChanges && !draftProtected && <p className="field-help" role="status">{label('saveBeforeAction')}</p>}
        {isQuote && canEdit && editor.invoice?.id && <section className={approvalStyles.panel} data-has-response={Boolean(quoteApproval.audit?.response)} aria-labelledby="quote-approval-admin-title">
        <div><h2 id="quote-approval-admin-title">{t('quoteApproval.adminTitle')}</h2><p>{t('quoteApproval.adminHelp')}</p></div>
        {editor.invoice.status === 'sent' && <label className={approvalStyles.emailChoice}><input type="checkbox" checked={sendApprovalEmail} onChange={event=>setSendApprovalEmail(event.target.checked)} disabled={quoteApproval.loading||hasUnsavedChanges||!editor.doc.customer.email}/><span>{t('quoteApproval.sendLinkEmail')}</span>{!editor.doc.customer.email&&<small>{t('quoteApproval.customerEmailRequired')}</small>}</label>}
        {editor.invoice.status === 'sent' && <button type="button" title={t('quoteApproval.generateLinkHelp')} className="primary-button" disabled={quoteApproval.loading || quoteApproval.emailLoading || hasUnsavedChanges} onClick={()=>issueQuoteApproval(editor.invoice,sendApprovalEmail)}>{quoteApproval.loading||quoteApproval.emailLoading ? t('common.loading') : sendApprovalEmail?t('quoteApproval.generateAndEmail'):t('quoteApproval.generateLink')}</button>}
        {hasUnsavedChanges && <p className="field-help">{label('saveBeforeAction')}</p>}
        {quoteApproval.error && <p className={approvalStyles.error} role="alert">{t('quoteApproval.adminError')}</p>}
        {quoteApproval.emailSent && <p className={approvalStyles.emailSuccess} role="status">{t('quoteApproval.linkEmailSent')}</p>}
        {quoteApproval.emailWarning && <p className={approvalStyles.error} role="status">{t('quoteApproval.linkEmailUncertain')}</p>}
        {quoteApproval.emailError && <p className={approvalStyles.error} role="alert">{t('quoteApproval.linkEmailFailed')}</p>}
        {quoteApproval.auditError && <p className={approvalStyles.error} role="alert">{t('quoteApproval.auditError')}</p>}
        {quoteApproval.quoteId === editor.invoice.id && quoteApproval.url && <div className={approvalStyles.linkRow}>
          <label className="field"><span className="field-label">{t('quoteApproval.generatedLink')}</span><input className="input" readOnly value={quoteApproval.url} onFocus={event=>event.target.select()} /></label>
          <button type="button" title={t('quoteApproval.copyLinkHelp')} className="ghost-button" onClick={copyQuoteApprovalLink}>{t('quoteApproval.copyLink')}</button>
          {quoteApproval.expiresAt && <small>{t('quoteApproval.linkExpires')} {new Date(quoteApproval.expiresAt).toLocaleDateString(language==='en'?'en-GB':'es-ES')}</small>}
        </div>}
        {quoteApproval.audit?.response && <dl className={approvalStyles.response}>
          <div><dt>{t('quoteApproval.currentQuoteStatus')}</dt><dd><strong className={approvalStyles.status} data-status={quoteApproval.audit.quote_status}>{t(`quotes.${quoteApproval.audit.quote_status}`)}</strong></dd></div>
          <div><dt>{t('quoteApproval.responseDecision')}</dt><dd>{t(`quotes.${quoteApproval.audit.response.decision}`)}</dd></div>
          <div><dt>{t('quoteApproval.responseIdentity')}</dt><dd>{quoteApproval.audit.response.declared_name} · {quoteApproval.audit.response.declared_email}</dd></div>
          <div><dt>{t('quoteApproval.respondedAt')}</dt><dd><time dateTime={quoteApproval.audit.response.responded_at}>{new Date(quoteApproval.audit.response.responded_at).toLocaleString(language==='en'?'en-GB':'es-ES')}</time></dd></div>
          {quoteApproval.audit.response.reason && <div><dt>{t('quoteApproval.reason')}</dt><dd>{quoteApproval.audit.response.reason}</dd></div>}
        </dl>}
        {(quoteApproval.audit?.responses?.length||0)>1 && <details className={approvalStyles.responses}>
          <summary>{t('quoteApproval.responseHistory')}</summary>
          <ol>{quoteApproval.audit.responses.map(response=><li key={response.id}><strong>{t(`quotes.${response.decision}`)}</strong><span>{response.declared_name} · {response.declared_email}</span><time dateTime={response.responded_at}>{new Date(response.responded_at).toLocaleString(language==='en'?'en-GB':'es-ES')}</time>{response.reason&&<p>{response.reason}</p>}</li>)}</ol>
        </details>}
        {quoteApproval.audit?.links?.length > 0 && <details className={approvalStyles.links}><summary>{t('quoteApproval.linkHistory')}</summary><ul>{quoteApproval.audit.links.map((link,index)=>{
          const linkState=link.revoked_at?'revoked':link.resolved_at?'resolved':new Date(link.expires_at)<=new Date()?'expired':'active'
          return <li key={`${link.issued_at}-${index}`}><span>{t(`quoteApproval.linkState.${linkState}`)}</span><time dateTime={link.issued_at}>{new Date(link.issued_at).toLocaleString(language==='en'?'en-GB':'es-ES')}</time><small>{t('quoteApproval.linkExpires')} {new Date(link.expires_at).toLocaleDateString(language==='en'?'en-GB':'es-ES')}</small>{link.email_sent_at&&<small>{t('quoteApproval.linkEmailSentAt')}: {new Date(link.email_sent_at).toLocaleString(language==='en'?'en-GB':'es-ES')}</small>}{link.company_notified_at&&<small>{t('quoteApproval.companyNotifiedAt')}: {new Date(link.company_notified_at).toLocaleString(language==='en'?'en-GB':'es-ES')}</small>}</li>
        })}</ul></details>}
      </section>}
      {canEdit && !editor.rectificationSource && (!editor.invoice || editor.invoice.status==='draft') && <DocumentDraftRecovery key={routeId} ref={draftRef} scope={{userId,companyId:company.id,kind,key:routeId}} document={editor.doc} baseVersion={editor.invoice?.version ?? null} t={t}
        onOpenCompleted={record=>{setInvoices(previous=>[record,...previous.filter(item=>item.id!==record.id)]);draftRef.current?.complete();go(`/${encodeURIComponent(record.id)}`,{completed:true})}}
        onProtectionChange={setProtectedDraft} onGateChange={setDraftGate} onRecover={doc=>setEditor(previous=>({...previous,doc,status:'draft',useCompanyIssuer:usesCompanyIssuer(doc.issuer,profile),customIssuer:structuredClone(doc.issuer)}))}/>}
      <BillingDocumentForm editor={editor} company={company} profile={profile} hasSavedIssuer={hasSavedIssuer} locked={locked || draftGate} canEdit={canEdit} saving={saving} isQuote={isQuote} field={field} profileFields={profileFields} updateDoc={updateDoc} setEditor={setEditor} saveIssuer={saveIssuer} persist={persist} statuses={statuses} label={label} t={t} money={money} error={error} errorRef={errorRef}
        reuse={reuse} onReuseRetry={()=>setReuseReload(value=>value+1)} onCreateClient={createReuseClient} onCreateCatalogItem={createReuseItem} onArchiveCatalogItem={archiveReuseItem}
        templates={templates} onTemplateRetry={()=>setTemplateReload(value=>value+1)} onApplyTemplate={applyTemplate} onSaveTemplate={saveTemplate} onArchiveTemplate={archiveTemplate} appearance={<details className="document-appearance-details">
        <summary><Icon name="image" size={18}/><span>{t('billingAppearance.documentTitle')}</span><span>{t('billingAppearance.personalize')}</span></summary>
        <p className="field-help">{t('billingAppearance.documentHelp')}</p>
        <DocumentAppearance profile={editor.doc.issuer} onChange={updateIssuer} disabled={locked || saving} onBusyChange={setLogoBusy} paletteLibrary={paletteLibrary}/>
        {!locked && <div className="document-appearance-actions"><DocumentActionButton variant="outline" disabled={saving || logoBusy} onClick={()=>updateIssuer(previous=>withBillingAppearance(previous,profile))}>{t('billingAppearance.reset')}</DocumentActionButton>
        <DocumentActionButton disabled={saving || logoBusy || !validBillingProfile(withBillingAppearance(profile,editor.doc.issuer))} onClick={saveAppearanceDefault}>{t('billingAppearance.saveDefault')}</DocumentActionButton></div>}
        {!hasSavedIssuer && <p className="field-help">{t('billingAppearance.needsIssuer')}</p>}
      </details>}/>
      {editor.invoice&&<BillingFinancePanel invoice={editor.invoice} summary={isQuote?undefined:financialById.get(editor.invoice.id)} detail={financeDetail} reminderPreference={reminderPreference} onToggleReminder={changeInvoiceReminderPreference} historyOnly={isQuote} disabled={!canEdit||saving} onRegister={registerPayment} onReverse={reversePayment} onRestore={restoreVersion} onLoadMore={loadMoreHistory} t={t} money={money}/>}

    </DocumentEditorPage>}
  </div>
}
