import {useEffect,useState} from 'react'
import {loadBillingDueReminderSettings,loadBillingDueReminderFailures,retryBillingDueReminder,saveBillingDueReminderSettings} from '../services/billingFinanceService'
import styles from './BillingDueReminderSettings.module.css'

const parseOffsets=value=>{
  const raw=value.split(',').map(item=>item.trim()).filter(Boolean)
  if(!raw.length||raw.length>8||raw.some(item=>!/^(-?\d+)$/.test(item)))return null
  const parsed=raw.map(Number)
  if(parsed.some(item=>item < -90||item>90))return null
  return [...new Set(parsed)].sort((a,b)=>b-a)
}

export default function BillingDueReminderSettings({companyId,canManage,canRetry,t}){
  const[settings,setSettings]=useState(null)
  const[offsets,setOffsets]=useState('7, 1, 0, -7')
  const[sendTime,setSendTime]=useState('09:00')
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const[saved,setSaved]=useState(false)
  const[failures,setFailures]=useState({rows:[],loading:true,error:false})
  const[retrying,setRetrying]=useState('')
  const[retryError,setRetryError]=useState(false)
  useEffect(()=>{let current=true;setLoading(true);setError('');loadBillingDueReminderSettings(companyId).then(value=>{if(!current)return;setSettings(value);setOffsets(value.offsets_days.join(', '));setSendTime(value.local_send_time.slice(0,5))}).catch(()=>{if(current)setError(t('billingReminders.loadError'))}).finally(()=>{if(current)setLoading(false)});return()=>{current=false}},[companyId,t])
  const refreshFailures=async()=>{setFailures(previous=>({...previous,loading:true,error:false}));try{const rows=await loadBillingDueReminderFailures(companyId);setFailures({rows,loading:false,error:false})}catch{setFailures(previous=>({...previous,loading:false,error:true}))}}
  useEffect(()=>{let current=true;loadBillingDueReminderFailures(companyId).then(rows=>{if(current)setFailures({rows,loading:false,error:false})}).catch(()=>{if(current)setFailures({rows:[],loading:false,error:true})});return()=>{current=false}},[companyId])
  const retry=async id=>{if(!canRetry||retrying)return;setRetrying(id);setRetryError(false);try{const retried=await retryBillingDueReminder(companyId,id);if(retried)await refreshFailures();else setRetryError(true)}catch{setRetryError(true)}finally{setRetrying('')}}
  const update=async event=>{event.preventDefault();if(!canManage||saving||!settings)return;const offsetsDays=parseOffsets(offsets);if(!offsetsDays){setError(t('billingReminders.invalidOffsets'));return}setSaving(true);setError('');setSaved(false);try{const next=await saveBillingDueReminderSettings(companyId,{enabled:settings.enabled,offsetsDays,sendTime});setSettings(next);setOffsets(next.offsets_days.join(', '));setSaved(true)}catch{setError(t('billingReminders.saveError'))}finally{setSaving(false)}}
  const toggle=async event=>{const enabled=event.target.checked;const offsetsDays=parseOffsets(offsets);if(!offsetsDays){setError(t('billingReminders.invalidOffsets'));return}setSettings(previous=>({...previous,enabled}));setError('');setSaved(false);setSaving(true);try{const next=await saveBillingDueReminderSettings(companyId,{enabled,offsetsDays,sendTime});setSettings(next);setSaved(true)}catch{setSettings(previous=>({...previous,enabled:!enabled}));setError(t('billingReminders.saveError'))}finally{setSaving(false)}}
  return <section className={styles.panel} aria-labelledby="billing-due-reminders-title"><div className={styles.heading}><div><h2 id="billing-due-reminders-title">{t('billingReminders.title')}</h2><p>{t('billingReminders.help')}</p></div>{settings&&<span className={settings.enabled?styles.enabled:styles.disabled}>{t(settings.enabled?'billingReminders.enabled':'billingReminders.disabled')}</span>}</div>
    {loading?<p role="status">{t('common.loading')}</p>:error&& !settings?<p role="alert" className={styles.error}>{error}</p>:settings&&<form onSubmit={update}>
      <label className={styles.switch}><input type="checkbox" checked={settings.enabled} disabled={!canManage||saving} onChange={toggle}/><span>{t('billingReminders.enable')}</span></label>
      <div className={styles.fields}><label><span>{t('billingReminders.offsets')}</span><input className="input" value={offsets} disabled={!canManage||saving} onChange={event=>setOffsets(event.target.value)} aria-describedby="billing-reminder-offset-help"/></label><label><span>{t('billingReminders.time')}</span><input className="input" type="time" value={sendTime} disabled={!canManage||saving} onChange={event=>setSendTime(event.target.value)}/></label></div>
      <small id="billing-reminder-offset-help">{t('billingReminders.offsetHelp')}</small>
      <p className={styles.note}>{t('billingReminders.deliveryPending')}</p>
      {canManage&&<button className="ghost-button" type="submit" disabled={saving||loading}>{t(saving?'common.savingChanges':'common.save')}</button>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}{saved&&<p role="status" className={styles.success}>{t('billingReminders.saved')}</p>}
    </form>}
    <div className={styles.failures}><h3>{t('billingReminders.failuresTitle')}</h3>{failures.loading?<p role="status">{t('common.loading')}</p>:failures.error?<p role="alert" className={styles.error}>{t('billingReminders.failuresError')}</p>:!failures.rows.length?<p>{t('billingReminders.noFailures')}</p>:<ul>{failures.rows.map(item=><li key={item.id}><div><strong>{item.invoice_number} · {item.customer_name}</strong><span>{item.due_date} · {t(`billingReminders.errors.${item.last_error_code}`)} · {t('billingReminders.attempts')}: {item.attempt_count}</span></div>{canRetry&&<button className="ghost-button" type="button" disabled={Boolean(retrying)} onClick={()=>retry(item.id)}>{retrying===item.id?t('common.loading'):t('billingReminders.retry')}</button>}</li>)}</ul>}{retryError&&<p role="alert" className={styles.error}>{t('billingReminders.retryError')}</p>}</div>
  </section>
}
