import { useId } from 'react'
import { samePaletteColors } from '../lib/billingAppearance'
import { useLanguage } from '../contexts/LanguageContext'
import DocumentActionButton from './ui/DocumentActionButton'
import styles from './BillingPaletteLibrary.module.css'

export default function BillingPaletteSelector({library,palette,onSelect}) {
  const {t}=useLanguage()
  const id=useId()
  const selected=palette?.id==='custom' ? library.entries.find(entry=>samePaletteColors(palette,entry.palette)) : null
  return <div className={styles.selector}>
    <label className="field-label" htmlFor={id}>{t('namedPalettes.select')}</label>
    <div className={styles.choice}>
      <select id={id} className="select" aria-label={t('namedPalettes.select')} aria-describedby={`${id}-help`}
        disabled={library.saving || library.status!=='ready' || !library.entries.length} value={selected?.id || ''}
        onChange={event=>{const entry=library.entries.find(item=>item.id===event.target.value);if(entry)onSelect(structuredClone(entry.palette))}}>
        <option value="" disabled>{t(library.status==='loading' ? 'common.loading' : library.status==='ready' && !library.entries.length ? 'namedPalettes.empty' : 'namedPalettes.choose')}</option>
        {library.entries.map(entry=><option value={entry.id} key={entry.id}>{entry.name}</option>)}
      </select>
      {selected && <span className={styles.swatches} aria-hidden="true">{['accent','ink','surface'].map(role=><i key={role} style={{background:selected.palette[role]}}/>)}</span>}
    </div>
    <p id={`${id}-help`} className="field-help">{t('namedPalettes.help')}</p>
    {library.status==='loading' && <span role="status" className="visually-hidden">{t('common.loading')}</span>}
    {library.status==='error' && <div role="alert"><p>{t('namedPalettes.loadError')}</p><DocumentActionButton variant="outline" onClick={library.reload}>{t('invoicing.retry')}</DocumentActionButton></div>}
  </div>
}
