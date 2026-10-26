import { useEffect, useId, useRef, useState } from 'react'
import { samePaletteColors, validBillingPalette, validPaletteName } from '../lib/billingAppearance'
import { useLanguage } from '../contexts/LanguageContext'
import DocumentActionButton from './ui/DocumentActionButton'
import styles from './BillingPaletteLibrary.module.css'

export default function BillingPaletteLibrary({library,palette}) {
  const {t}=useLanguage()
  const id=useId()
  const [name,setName]=useState('')
  const [saved,setSaved]=useState(null)
  const active=useRef(true)
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
  const canSave=library.canEdit && library.status==='ready' && validPaletteName(name) && validBillingPalette(palette) && palette.id==='custom' && !library.saving
  const save=async()=>{
    if(!canSave)return
    setSaved(null)
    const entry=await library.save(name,palette)
    if(entry && active.current){setName('');setSaved(entry.palette)}
  }
  if(!library.canEdit || palette?.id!=='custom')return null
  return <fieldset className={styles.library} disabled={library.saving}>
    <legend>{t('namedPalettes.saveTitle')}</legend>
    <div className={styles.save}>
      <label htmlFor={id} className="field-label">{t('namedPalettes.name')}</label>
      <input id={id} className="input" type="text" maxLength={60} value={name} placeholder={t('namedPalettes.placeholder')}
        aria-describedby={`${id}-help${library.saveError ? ` ${id}-error` : ''}`} onChange={event=>{setName(event.target.value);setSaved(null)}}
        onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();save()}}}/>
      <span id={`${id}-help`} className="field-help">{t('namedPalettes.nameHelp')}</span>
      <DocumentActionButton disabled={!canSave} onClick={save}>{t(library.saving ? 'common.savingChanges' : 'namedPalettes.save')}</DocumentActionButton>
      {library.saveError && <p id={`${id}-error`} className="field-error" role="alert">{t(`namedPalettes.${library.saveError}`)}</p>}
      {saved && samePaletteColors(palette,saved) && <p role="status">{t('namedPalettes.saved')}</p>}
    </div>
  </fieldset>
}
