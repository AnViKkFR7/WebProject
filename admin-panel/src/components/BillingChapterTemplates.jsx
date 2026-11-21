import {useMemo,useRef,useState} from 'react'
import DocumentActionButton from './ui/DocumentActionButton'
import styles from './BillingChapterTemplates.module.css'

export default function BillingChapterTemplates({templates,lines,loading,error,disabled,onRetry,onApply,onSave,onArchive,t}) {
  const [query,setQuery]=useState('');const [name,setName]=useState('');const [saving,setSaving]=useState(false);const [saveError,setSaveError]=useState('')
  const nameInput=useRef(null);const inFlight=useRef(false)
  const visible=useMemo(()=>templates.filter(template=>template.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,20),[templates,query])
  const save=async()=>{
    if(disabled||inFlight.current)return
    const input=nameInput.current
    if(!name.trim()||name.length>100){setSaveError(t('chapterTemplates.invalidName'));input.focus();return}
    inFlight.current=true;setSaving(true);setSaveError('')
    try{await onSave({name:name.trim(),lines});setName('')}
    catch{setSaveError(t('chapterTemplates.saveError'))}
    finally{inFlight.current=false;setSaving(false)}
  }
  // Template inputs are local actions, not fields of the enclosing quote form.
  // Enter must never trigger that form's implicit submission.
  const enter=event=>{
    if(event.key!=='Enter'||event.target.tagName!=='INPUT'||event.nativeEvent.isComposing)return
    event.preventDefault();event.stopPropagation()
    if(event.target===nameInput.current)void save()
  }
  return <section className={styles.panel} aria-labelledby="chapter-template-title" onKeyDown={enter}>
    <div className={styles.heading}><div><h3 id="chapter-template-title">{t('chapterTemplates.title')}</h3><p>{t('chapterTemplates.help')}</p></div></div>
    <div className={styles.search}><label className="field"><span className="field-label">{t('chapterTemplates.search')}</span><input className="input" form="" type="search" value={query} onChange={event=>setQuery(event.target.value)} disabled={disabled}/></label></div>
    {loading && <p role="status">{t('common.loading')}</p>}
    {error && <p role="alert" className="field-error">{t('chapterTemplates.loadError')} <button type="button" onClick={onRetry}>{t('common.retry')}</button></p>}
    {!loading && !error && query && <div className={styles.results}>{!visible.length && <p>{t('chapterTemplates.empty')}</p>}{visible.map(template=><div className={styles.result} key={template.id}><button type="button" disabled={disabled} onClick={()=>onApply(template)}><strong>{template.name}</strong><span>{t('chapterTemplates.items').replace('{count}',template.lines.length)}</span></button><button type="button" className={styles.archive} disabled={disabled} aria-label={`${t('chapterTemplates.archive')} ${template.name}`} onClick={()=>onArchive(template)}>{t('chapterTemplates.archive')}</button></div>)}</div>}
    <div className={styles.save}><label className="field"><span className="field-label">{t('chapterTemplates.name')}</span><input ref={nameInput} className="input" form="" aria-required="true" maxLength={100} value={name} onChange={event=>{setSaveError('');setName(event.target.value)}} disabled={disabled || saving}/></label><DocumentActionButton type="button" onClick={save} variant="outline" disabled={disabled || saving}>{t(saving?'common.savingChanges':'chapterTemplates.save')}</DocumentActionButton>{saveError && <p className="field-error" role="alert">{saveError}</p>}</div>
  </section>
}
