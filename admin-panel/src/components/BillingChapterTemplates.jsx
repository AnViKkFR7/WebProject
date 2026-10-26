import {useMemo,useState} from 'react'
import DocumentActionButton from './ui/DocumentActionButton'
import styles from './BillingChapterTemplates.module.css'

export default function BillingChapterTemplates({templates,lines,loading,error,disabled,onRetry,onApply,onSave,onArchive,t}) {
  const [query,setQuery]=useState('');const [name,setName]=useState('');const [saving,setSaving]=useState(false);const [saveError,setSaveError]=useState('')
  const visible=useMemo(()=>templates.filter(template=>template.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,20),[templates,query])
  const save=async event=>{event.preventDefault();setSaving(true);setSaveError('');try{await onSave({name,lines});setName('')}catch{setSaveError(t('chapterTemplates.saveError'))}finally{setSaving(false)}}
  return <section className={styles.panel} aria-labelledby="chapter-template-title">
    <div className={styles.heading}><div><h3 id="chapter-template-title">{t('chapterTemplates.title')}</h3><p>{t('chapterTemplates.help')}</p></div></div>
    <div className={styles.search}><label className="field"><span className="field-label">{t('chapterTemplates.search')}</span><input className="input" type="search" value={query} onChange={event=>setQuery(event.target.value)} disabled={disabled}/></label></div>
    {loading && <p role="status">{t('common.loading')}</p>}
    {error && <p role="alert" className="field-error">{t('chapterTemplates.loadError')} <button type="button" onClick={onRetry}>{t('common.retry')}</button></p>}
    {!loading && !error && query && <div className={styles.results}>{!visible.length && <p>{t('chapterTemplates.empty')}</p>}{visible.map(template=><div className={styles.result} key={template.id}><button type="button" disabled={disabled} onClick={()=>onApply(template)}><strong>{template.name}</strong><span>{t('chapterTemplates.items').replace('{count}',template.lines.length)}</span></button><button type="button" className={styles.archive} disabled={disabled} aria-label={`${t('chapterTemplates.archive')} ${template.name}`} onClick={()=>onArchive(template)}>{t('chapterTemplates.archive')}</button></div>)}</div>}
    <form className={styles.save} onSubmit={save}><label className="field"><span className="field-label">{t('chapterTemplates.name')}</span><input className="input" required maxLength={100} value={name} onChange={event=>setName(event.target.value)} disabled={disabled || saving}/></label><DocumentActionButton type="submit" variant="outline" disabled={disabled || saving}>{t(saving?'common.savingChanges':'chapterTemplates.save')}</DocumentActionButton>{saveError && <p className="field-error" role="alert">{saveError}</p>}</form>
  </section>
}
