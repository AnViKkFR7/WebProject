import {useMemo,useState} from 'react'
import DocumentActionButton from './ui/DocumentActionButton'
import styles from './BillingReusePanel.module.css'

const emptyClient={name:'',taxId:'',address:'',email:'',phone:''}
const emptyItem={name:'',description:'',unit:'',price:'',tax:'21'}
export default function BillingReusePanel({mode,entries,loading,error,disabled,onRetry,onSelect,onCreate,onArchive,t}) {
  const [query,setQuery]=useState('')
  const [form,setForm]=useState(mode==='client' ? emptyClient : emptyItem)
  const [open,setOpen]=useState(false)
  const [saving,setSaving]=useState(false)
  const [saveError,setSaveError]=useState('')
  const filtered=useMemo(()=>entries.filter(entry=>[entry.name,entry.tax_id,entry.description,entry.unit].filter(Boolean).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,20),[entries,query])
  const prefix=`billingReuse.${mode}`
  const change=(key,value)=>setForm(previous=>({...previous,[key]:value}))
  const submit=async event=>{
    event.preventDefault();setSaving(true);setSaveError('')
    try {const created=await onCreate(form);onSelect(created);setForm(mode==='client' ? emptyClient : emptyItem);setOpen(false)}
    catch {setSaveError(t('billingReuse.saveError'))}
    finally {setSaving(false)}
  }
  return <div className={styles.panel}>
    <div className={styles.toolbar}>
      <label className="field"><span className="field-label">{t(`${prefix}.search`)}</span><input className="input" type="search" value={query} onChange={event=>setQuery(event.target.value)} disabled={disabled}/></label>
      <DocumentActionButton type="button" variant="outline" disabled={disabled} onClick={()=>setOpen(value=>!value)}>{t(`${prefix}.new`)}</DocumentActionButton>
    </div>
    {loading && <p role="status" className="field-help">{t('common.loading')}</p>}
    {error && <p role="alert" className="field-error">{t('billingReuse.loadError')} <button type="button" onClick={onRetry}>{t('common.retry')}</button></p>}
    {!loading && !error && query && <div className={styles.results}>
      {!filtered.length && <p className="field-help">{t('billingReuse.empty')}</p>}
      {filtered.map(entry=><div className={styles.result} key={entry.id}><button type="button" disabled={disabled} onClick={()=>{onSelect(entry);setQuery('')}}><strong>{entry.name}</strong><span>{mode==='client' ? [entry.tax_id,entry.billing_address].filter(Boolean).join(' · ') : [entry.unit,Number(entry.price).toFixed(2)+' €',entry.tax+'%'].filter(Boolean).join(' · ')}</span></button>{onArchive && <button className={styles.archive} type="button" disabled={disabled} aria-label={`${t(`${prefix}.archive`)} ${entry.name}`} onClick={()=>onArchive(entry)}>{t(`${prefix}.archive`)}</button>}</div>)}
    </div>}
    {open && <form className={styles.form} onSubmit={submit}>
      {(mode==='client'
        ? [['name','text',true],['taxId','text',true],['address','text',true],['email','email',false],['phone','tel',false]]
        : [['name','text',true],['description','text',false],['unit','text',false],['price','number',true],['tax','number',true]])
        .map(([key,type,required])=><label className="field" key={key}><span className="field-label">{t(`${prefix}.${key}`)}{required?' *':''}</span><input className="input" type={type} required={required} min={type==='number'?'0':undefined} max={key==='tax'?'100':undefined} step={type==='number'?'0.01':undefined} value={form[key]} onChange={event=>change(key,event.target.value)} disabled={saving}/></label>)}
      {saveError && <p className="field-error" role="alert">{saveError}</p>}
      <DocumentActionButton type="submit" disabled={saving}>{t(saving?'common.savingChanges':'common.save')}</DocumentActionButton>
    </form>}
  </div>
}
