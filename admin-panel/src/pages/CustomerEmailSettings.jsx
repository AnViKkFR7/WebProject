import {useEffect,useMemo,useState} from 'react'
import {useCompany} from '../contexts/CompanyContext'
import {useLanguage} from '../contexts/LanguageContext'
import {useFeedback} from '../contexts/FeedbackContext'
import {billingPalettes,contrastRatio,validBillingPalette} from '../lib/billingAppearance'
import {readBillingLogo} from '../lib/billingLogo'
import {customerEmailVariables,defaultCustomerEmailSettings,emailLayouts,renderCustomerBillingEmail} from '../lib/customerEmailTemplate'
import {loadCustomerEmailRevisions,loadCustomerEmailSettings,restoreCustomerEmailRevision,saveCustomerEmailSettings} from '../services/customerEmailSettingsService'
import {useBillingPaletteLibrary} from '../hooks/useBillingPaletteLibrary'
import BillingPaletteSelector from '../components/BillingPaletteSelector'
import Icon from '../components/ui/Icon'
import styles from './CustomerEmailSettings.module.css'

const exampleData={quote_approval:{customer_name:'Ana García',quote_number:'P-000123',approval_url:'https://example.invalid/quotes/respond#demo-token',expires_at:'25/11/2026'},invoice_due:{invoice_number:'F-000456',due_date:'24 de noviembre de 2026',balance:'363,00 €'}}

export default function CustomerEmailSettings(){
  const{selectedCompany,isPlatformAdmin}=useCompany()
  const{t,language}=useLanguage()
  const{toast}=useFeedback()
  const[settings,setSettings]=useState(defaultCustomerEmailSettings)
  const[kind,setKind]=useState('quote_approval')
  const[templateLanguage,setTemplateLanguage]=useState(language==='en'?'en':'es')
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const[logoError,setLogoError]=useState('')
  const[saved,setSaved]=useState(false)
  const[previewWidth,setPreviewWidth]=useState('mobile')
  const[revisions,setRevisions]=useState([])
  const[restoring,setRestoring]=useState('')
  const canManage=Boolean(isPlatformAdmin||selectedCompany?.userRole==='admin')
  const paletteLibrary=useBillingPaletteLibrary(selectedCompany?.id,canManage)

  useEffect(()=>{
    if(!selectedCompany?.id||!canManage){setLoading(false);return}
    let current=true
    setLoading(true);setError('');setRevisions([]);setSettings(defaultCustomerEmailSettings())
    Promise.all([loadCustomerEmailSettings(selectedCompany.id),loadCustomerEmailRevisions(selectedCompany.id)]).then(([value,history])=>{if(current){setSettings(value);setRevisions(history)}}).catch(()=>{if(current)setError(t('customerEmails.loadError'))}).finally(()=>{if(current)setLoading(false)})
    return()=>{current=false}
  },[selectedCompany?.id,canManage,t])

  const currentTemplate=settings.templates?.[kind]?.[templateLanguage]||defaultCustomerEmailSettings().templates[kind][templateLanguage]
  const templateErrors=useMemo(()=>{
    const failures=[]
    for(const templateKind of ['quote_approval','invoice_due'])for(const locale of ['es','en']){
      try{renderCustomerBillingEmail({kind:templateKind,language:locale,companyName:selectedCompany?.name||'Tu empresa',data:exampleData[templateKind],brand:settings.brand,template:settings.templates?.[templateKind]?.[locale],preview:true})}
      catch{failures.push(`${t(`customerEmails.kinds.${templateKind}`)} · ${locale.toUpperCase()}`)}
    }
    return failures
  },[settings.brand,settings.templates,selectedCompany?.name,t])
  const preview=useMemo(()=>{
    try{return renderCustomerBillingEmail({kind,language:templateLanguage,companyName:selectedCompany?.name||'Tu empresa',data:exampleData[kind],brand:settings.brand,template:currentTemplate,preview:true})}
    catch{return null}
  },[kind,templateLanguage,selectedCompany?.name,settings.brand,currentTemplate])
  const paletteErrors=useMemo(()=>{
    if(!settings.brand?.palette||!validBillingPalette(settings.brand.palette))return [t('customerEmails.invalidPalette')]
    const p=settings.brand.palette
    return [['ink','paper'],['muted','paper'],['ink','surface'],['muted','surface'],['accent','paper']]
      .filter(([foreground,background])=>contrastRatio(p[foreground],p[background])<4.5)
      .map(([foreground,background])=>t('customerEmails.contrastPair').replace('{foreground}',t(`billingAppearance.${foreground}`)).replace('{background}',t(`billingAppearance.${background}`)))
  },[settings.brand?.palette,t])
  const updateBrand=patch=>{setSettings(previous=>({...previous,brand:{...previous.brand,...patch}}));setSaved(false)}
  const updatePalette=(role,value)=>{const palette={...settings.brand.palette,id:'custom',[role]:value};updateBrand({palette})}
  const updateTemplate=patch=>{setSettings(previous=>({...previous,templates:{...previous.templates,[kind]:{...previous.templates[kind],[templateLanguage]:{...previous.templates[kind][templateLanguage],...patch}}}}));setSaved(false)}
  const uploadLogo=async event=>{
    const file=event.target.files?.[0];event.target.value=''
    if(!file)return
    try{const logo=await readBillingLogo(file);updateBrand({logo});setLogoError('')}
    catch{setLogoError(t('customerEmails.logoError'))}
  }
  const insertVariable=variable=>{
    const token=`{{${variable}}}`
    updateTemplate({html:`${currentTemplate.html}${token}`})
  }
  const save=async event=>{
    event.preventDefault()
    if(!canManage||saving||loading||paletteErrors.length||templateErrors.length){setError(t('customerEmails.invalidTemplate'));return}
    setSaving(true);setError('');setSaved(false)
    try{
      await saveCustomerEmailSettings(selectedCompany.id,settings);setSaved(true);toast.success(t('customerEmails.saved'))
      loadCustomerEmailRevisions(selectedCompany.id).then(setRevisions).catch(()=>setError(t('customerEmails.historyError')))
    }
    catch{setError(t('customerEmails.saveError'))}
    finally{setSaving(false)}
  }
  const restoreRevision=async revision=>{
    if(restoring||!window.confirm(t('customerEmails.restoreConfirm')))return
    setRestoring(revision.revision_id);setError('');setSaved(false)
    try{
      await restoreCustomerEmailRevision(selectedCompany.id,revision.revision_id)
      const[value,history]=await Promise.all([loadCustomerEmailSettings(selectedCompany.id),loadCustomerEmailRevisions(selectedCompany.id)])
      setSettings(value);setRevisions(history);setSaved(true);toast.success(t('customerEmails.restored'))
    }catch{setError(t('customerEmails.restoreError'))}
    finally{setRestoring('')}
  }

  if(!selectedCompany)return <section className={styles.page}><h1>{t('customerEmails.title')}</h1><p role="status">{t('customerEmails.noCompany')}</p></section>
  if(!canManage)return <section className={styles.page}><h1>{t('customerEmails.title')}</h1><p role="alert">{t('customerEmails.forbidden')}</p></section>
  if(loading)return <section className={styles.page}><h1>{t('customerEmails.title')}</h1><p role="status">{t('common.loading')}</p></section>

  return <section className={styles.page}>
    <header className={styles.heading}><div><h1>{t('customerEmails.title')}</h1><p>{t('customerEmails.help').replace('{company}',selectedCompany.name)}</p></div></header>
    <form onSubmit={save} className={styles.form}>
      <section className={styles.card} aria-labelledby="customer-email-brand-title">
        <div className={styles.sectionHeading}><div><h2 id="customer-email-brand-title">{t('customerEmails.brandTitle')}</h2><p>{t('customerEmails.brandHelp')}</p></div><span>{t('customerEmails.sharedBadge')}</span></div>
        <div className={styles.brandGrid}>
          <div className={styles.brandControls}>
            <fieldset className={styles.layouts}><legend>{t('customerEmails.layout')}</legend>{emailLayouts.map(layout=><label key={layout} className={styles.layoutChoice}><input type="radio" name="email-layout" value={layout} checked={settings.brand.layout===layout} onChange={()=>updateBrand({layout})}/><span><strong>{t(`customerEmails.layouts.${layout}`)}</strong><small>{t(`customerEmails.layoutsHelp.${layout}`)}</small></span></label>)}</fieldset>
            <label><span>{t('customerEmails.sendLanguage')}</span><select className="select" value={settings.brand.emailLanguage||'es'} onChange={event=>updateBrand({emailLanguage:event.target.value})}><option value="es">Español</option><option value="en">English</option></select><small>{t('customerEmails.sendLanguageHelp')}</small></label>
            <div className={styles.logoControl}><div><strong>{t('customerEmails.logo')}</strong><p>{t('customerEmails.logoHelp')}</p></div><label className="ghost-button"><Icon name="image" size={16}/>{t('customerEmails.chooseLogo')}<input type="file" accept="image/png,image/jpeg" onChange={uploadLogo}/></label>{settings.brand.logo&&<button className="ghost-button" type="button" onClick={()=>updateBrand({logo:''})}>{t('customerEmails.removeLogo')}</button>}</div>
            {logoError&&<p className="field-error" role="alert">{logoError}</p>}
            {settings.brand.logo&&<img className={styles.logoPreview} src={settings.brand.logo} alt={t('customerEmails.logoAlt')}/>}
            <div className={styles.paletteChoices} role="group" aria-label={t('customerEmails.palette')}>
              {billingPalettes.map(palette=><button key={palette.id} type="button" className={styles.palette} aria-pressed={settings.brand.palette.id===palette.id} onClick={()=>updateBrand({palette:{...palette}})}><span aria-hidden="true">{['accent','ink','surface'].map(role=><i key={role} style={{background:palette[role]}}/>)}</span><strong>{t(`billingAppearance.${palette.id}`)}</strong></button>)}
              <button type="button" className={styles.palette} aria-pressed={settings.brand.palette.id==='custom'} onClick={()=>updatePalette('accent',settings.brand.palette.accent)}><strong>{t('customerEmails.customPalette')}</strong></button>
            </div>
            <BillingPaletteSelector library={paletteLibrary} palette={settings.brand.palette} onSelect={palette=>updateBrand({palette})}/>
            {settings.brand.palette.id==='custom'&&<div className={styles.colorFields}>{['accent','ink','muted','paper','surface'].map(role=><label key={role}><span>{t(`billingAppearance.${role}`)}</span><input className="input" type="text" inputMode="text" maxLength={7} value={settings.brand.palette[role]} onChange={event=>updatePalette(role,event.target.value)} aria-label={`${t(`billingAppearance.${role}`)} HEX`}/></label>)}</div>}
            {paletteErrors.length>0&&<ul className="field-error" role="alert">{paletteErrors.map(message=><li key={message}>{message}</li>)}</ul>}
          </div>
          <div className={styles.previewCard}><div className={styles.previewHeader}><strong>{t('customerEmails.preview')}</strong><div role="group" aria-label={t('customerEmails.previewWidth')}><button type="button" aria-pressed={previewWidth==='mobile'} onClick={()=>setPreviewWidth('mobile')}>{t('customerEmails.mobile')}</button><button type="button" aria-pressed={previewWidth==='desktop'} onClick={()=>setPreviewWidth('desktop')}>{t('customerEmails.desktop')}</button></div></div>{!preview&&<p className="field-error" role="alert">{t('customerEmails.invalidTemplate')}</p>}<iframe title={t('customerEmails.preview')} sandbox="" className={`${styles.previewFrame} ${previewWidth==='mobile'?styles.mobileFrame:styles.desktopFrame}`} srcDoc={preview?.html||''}/><p>{t('customerEmails.previewSample')}</p></div>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="customer-email-templates-title">
        <div className={styles.sectionHeading}><div><h2 id="customer-email-templates-title">{t('customerEmails.templatesTitle')}</h2><p>{t('customerEmails.templatesHelp')}</p></div></div>
        <div className={styles.templateSelectors}>
          <label><span>{t('customerEmails.templateType')}</span><select className="select" value={kind} onChange={event=>setKind(event.target.value)}><option value="quote_approval">{t('customerEmails.kinds.quote_approval')}</option><option value="invoice_due">{t('customerEmails.kinds.invoice_due')}</option></select></label>
          <label><span>{t('customerEmails.templateLanguage')}</span><select className="select" value={templateLanguage} onChange={event=>setTemplateLanguage(event.target.value)}><option value="es">Español</option><option value="en">English</option></select></label>
        </div>
        <div className={styles.templateFields}>
          <label><span>{t('customerEmails.subject')}</span><input className="input" maxLength={180} value={currentTemplate.subject} onChange={event=>updateTemplate({subject:event.target.value})}/></label>
          <label><span>{t('customerEmails.preheader')}</span><input className="input" maxLength={240} value={currentTemplate.preheader} onChange={event=>updateTemplate({preheader:event.target.value})}/></label>
          <label><span>{t('customerEmails.html')}</span><textarea className="input" rows={12} maxLength={50000} spellCheck="false" value={currentTemplate.html} onChange={event=>updateTemplate({html:event.target.value})} aria-describedby="customer-email-html-help"/></label>
          <p id="customer-email-html-help" className={styles.editorHelp}>{t('customerEmails.htmlHelp')}</p>
          <div className={styles.variables}><strong>{t('customerEmails.variables')}</strong><p>{t('customerEmails.variablesHelp')}</p><div>{customerEmailVariables[kind].map(variable=><button type="button" className="ghost-button" key={variable} onClick={()=>insertVariable(variable)}>{`{{${variable}}}`}</button>)}</div></div>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="customer-email-history-title">
        <div className={styles.sectionHeading}><div><h2 id="customer-email-history-title">{t('customerEmails.historyTitle')}</h2><p>{t('customerEmails.historyHelp')}</p></div></div>
        {revisions.length===0?<p className={styles.historyEmpty}>{t('customerEmails.noHistory')}</p>:<ol className={styles.revisionList}>{revisions.map(revision=><li key={revision.revision_id}><div><strong>{new Date(revision.created_at).toLocaleString(templateLanguage==='en'?'en-GB':'es-ES',{dateStyle:'medium',timeStyle:'short'})}</strong><small>{t('customerEmails.revisionAuthor')}: {revision.created_by?revision.created_by.slice(0,8):t('customerEmails.unknownAuthor')}</small></div><button type="button" className="ghost-button" onClick={()=>restoreRevision(revision)} disabled={Boolean(restoring)||saving}>{restoring===revision.revision_id?t('customerEmails.restoring'):t('customerEmails.restore')}</button></li>)}</ol>}
      </section>
      {templateErrors.length>0&&<div className="field-error" role="alert"><p>{t('customerEmails.invalidTemplate')}</p><ul>{templateErrors.map(item=><li key={item}>{item}</li>)}</ul></div>}
      {error&&<p className="field-error" role="alert">{error}</p>}{saved&&<p className={styles.saved} role="status">{t('customerEmails.saved')}</p>}
      <footer className={styles.actions}><p>{t('customerEmails.noPerDocument')}</p><button className="primary-button" type="submit" disabled={saving||Boolean(restoring)||paletteErrors.length>0||templateErrors.length>0}>{saving?t('common.savingChanges'):t('common.save')}</button></footer>
    </form>
  </section>
}
