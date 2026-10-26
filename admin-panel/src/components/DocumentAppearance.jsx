import { useEffect, useId, useRef, useState } from 'react'
import { billingColorConflicts, billingColorSamples, billingPalettes, documentPalette, paletteRoles, selectBillingPalette, validBillingPalette, validHex } from '../lib/billingAppearance'
import { readBillingLogo } from '../lib/billingLogo'
import { useLanguage } from '../contexts/LanguageContext'
import ColorSelector from './ui/ColorSelector'
import Icon from './ui/Icon'
import DocumentActionButton from './ui/DocumentActionButton'
import BillingPaletteLibrary from './BillingPaletteLibrary'
import BillingPaletteSelector from './BillingPaletteSelector'
import styles from './DocumentAppearance.module.css'

export default function DocumentAppearance({profile,onChange,disabled=false,onBusyChange,paletteLibrary}) {
  const {t}=useLanguage()
  const logoHelpId=useId()
  const logoErrorId=useId()
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const request=useRef(0)
  const customFields=useRef(null)
  useEffect(()=>()=>{request.current+=1},[])
  const current=documentPalette(profile)
  const invalid=profile.palette && !validBillingPalette(profile.palette)
  const colorError=(role,color)=>{
    if (!validHex(color)) return t('billingColorPicker.invalidHex')
    const conflicts=billingColorConflicts(profile.palette,role,color)
    return conflicts.length ? t('billingColorPicker.conflict').replace('{roles}',conflicts.map(other=>t(`billingAppearance.${other}`)).join(', ')) : ''
  }
  useEffect(()=>{
    customFields.current?.querySelectorAll('input[type="text"]').forEach((input,index)=>{
      const role=paletteRoles[index]
      const conflicts=billingColorConflicts(profile.palette,role)
      input.setCustomValidity(!validHex(profile.palette?.[role]) ? t('billingColorPicker.invalidHex') : conflicts.length ? t('billingColorPicker.conflict').replace('{roles}',conflicts.map(other=>t(`billingAppearance.${other}`)).join(', ')) : '')
    })
  },[profile.palette,t])
  const upload=async event=>{
    const file=event.target.files?.[0];event.target.value=''
    if (!file) return
    const version=++request.current
    setError('');setBusy(true);onBusyChange?.(true)
    try {
      const logo=await readBillingLogo(file)
      if(version===request.current) onChange(previous=>({...previous,logo}))
    } catch { if(version===request.current) setError(t('invoicing.logoError')) }
    finally { if(version===request.current) {setBusy(false);onBusyChange?.(false)} }
  }
  return <fieldset className={styles.appearance} disabled={disabled || busy}>
    <legend className="visually-hidden">{t('billingAppearance.title')}</legend>
    <div className={styles.logo}>
      <span className={styles.logoFrame} style={profile.logo ? {background:current.paper} : undefined}>{profile.logo ? <img src={profile.logo} alt={t('invoicing.logo')}/> : <Icon name="image" size={28}/>}</span>
      <div><label className={styles.upload}><span>{t('billingAppearance.upload')}</span><input type="file" accept="image/png,image/jpeg" onChange={upload} aria-describedby={`${logoHelpId}${error ? ` ${logoErrorId}` : ''}`} aria-invalid={error ? true : undefined}/></label><p id={logoHelpId} className="field-help">{t('invoicing.logoHelp')}</p>
      {profile.logo && <DocumentActionButton variant="outline" onClick={()=>onChange({...profile,logo:''})}><Icon name="trash" size={14}/>{t('invoicing.removeLogo')}</DocumentActionButton>}</div>
    </div>
    {busy && <p role="status">{t('billingAppearance.processing')}</p>}
    {error && <p id={logoErrorId} className="field-error" role="alert">{error}</p>}
    <div className={styles.palettes} aria-label={t('billingAppearance.palettes')}>
      {billingPalettes.map(palette=><button key={palette.id} type="button" className={styles.palette} aria-pressed={profile.palette?.id===palette.id} onClick={()=>onChange(selectBillingPalette(profile,palette))}>
        <span className={styles.swatches} aria-hidden="true">{['accent','ink','surface'].map(role=><i key={role} style={{background:palette[role]}}/>)}</span>
        <strong>{t(`billingAppearance.${palette.id}`)}</strong><span>{t(`billingAppearance.${palette.id}Help`)}</span>
      </button>)}
      <button type="button" className={styles.palette} aria-pressed={profile.palette?.id==='custom'} onClick={()=>{const custom={...current,id:'custom'};onChange(selectBillingPalette(profile,validBillingPalette(custom) ? custom : {...billingPalettes[0],id:'custom'}))}}>
        <Icon name="edit" size={21}/><strong>{t('billingAppearance.custom')}</strong><span>{t('billingAppearance.customHelp')}</span>
      </button>
    </div>
    {paletteLibrary && <BillingPaletteSelector library={paletteLibrary} palette={profile.palette} onSelect={palette=>onChange(selectBillingPalette(profile,palette))}/>}
    {!profile.palette && <p className="field-help">{t('billingAppearance.legacy')}</p>}
    {profile.palette?.id==='custom' && <div ref={customFields} className={styles.custom}>
      <p className="field-help">{t('billingColorPicker.help')}</p>
      {paletteRoles.map(role=><ColorSelector key={role} label={t(`billingAppearance.${role}`)} value={profile.palette[role]}
        samples={billingColorSamples[role]} disabledReason={color=>colorError(role,color)} help={t(`billingColorPicker.${role}`)} error={colorError(role,profile.palette[role])}
        onChange={value=>onChange({...profile,palette:{...profile.palette,[role]:value},...(role==='accent' ? {color:value} : {})})}/>)}
    </div>}
    {paletteLibrary && <BillingPaletteLibrary library={paletteLibrary} palette={profile.palette}/>}
    {invalid && <p className="field-error" role="alert">{t('billingColorPicker.invalid')}</p>}
    <div className={styles.sample} style={{'--sample-paper':validHex(current.paper)?current.paper:'#ffffff','--sample-surface':validHex(current.surface)?current.surface:'#f1f3f5','--sample-ink':validHex(current.ink)?current.ink:'#20252b','--sample-muted':validHex(current.muted)?current.muted:'#58616d','--sample-accent':validHex(current.accent)?current.accent:'#334155'}} aria-label={t('billingAppearance.sample')}>
      <div>{profile.logo && <img src={profile.logo} alt=""/>}<strong>{profile.name || t('invoicing.issuer')}</strong><span>{t('billingAppearance.sample')}</span></div>
      <p>{t('billingAppearance.sampleText')}</p><div className={styles.sampleRow}><span>{t('invoicing.descriptionLine')}</span><strong>100,00 €</strong></div>
    </div>
  </fieldset>
}
