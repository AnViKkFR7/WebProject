import { useCallback, useEffect, useState } from 'react'
import { listPlanningEmailFailures, retryPlanningEmail } from '../../services/planningService'
import styles from './PlanningEmailFailures.module.css'

export default function PlanningEmailFailures({companyId,canEdit,t}) {
  const [failures,setFailures]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  const [retrying,setRetrying]=useState(null)
  const [notice,setNotice]=useState('')

  const load=useCallback(async activeCheck=>{
    setLoading(true);setError(false)
    try{const rows=await listPlanningEmailFailures(companyId);if(activeCheck())setFailures(rows)}
    catch{if(activeCheck())setError(true)}
    finally{if(activeCheck())setLoading(false)}
  },[companyId])

  useEffect(()=>{
    let active=true
    load(()=>active)
    return()=>{active=false}
  },[load])

  const retry=async id=>{
    setRetrying(id);setNotice('')
    try{
      const accepted=await retryPlanningEmail(companyId,id)
      if(!accepted){setNotice(t('emailRetryStale'));return}
      setFailures(rows=>rows.filter(row=>row.id!==id))
      setNotice(t('emailRetryQueued'))
    }catch{setNotice(t('emailRetryError'))}
    finally{setRetrying(null)}
  }

  if(loading)return <p className={styles.state} role="status">{t('emailFailuresLoading')}</p>
  if(error)return <div className={styles.state} role="alert"><span>{t('emailFailuresError')}</span><button type="button" className="ghost-button" onClick={()=>load(()=>true)}>{t('emailFailuresRetryLoad')}</button></div>

  return <section className={styles.panel} aria-labelledby="planning-email-failures-heading">
    <header className={styles.header}><div><h2 id="planning-email-failures-heading">{t('emailFailuresTitle')}</h2><p>{t('emailFailuresHelp')}</p></div><button type="button" className="ghost-button" onClick={()=>load(()=>true)}>{t('emailFailuresRefresh')}</button></header>
    {notice&&<p className={styles.notice} role="status">{notice}</p>}
    {failures.length===0?<p className={styles.state}>{t('emailFailuresEmpty')}</p>:<ul className={styles.list}>
      {failures.map(row=><li key={row.id} className={styles.item}>
        <div className={styles.details}><strong>{row.task_title || t('emailFailureUntitled')}</strong><span>{t(`emailFailure_${row.last_error_code}`)}</span><small>{t('emailFailureAttempts').replace('{count}',String(row.attempt_count))} · {new Date(row.updated_at).toLocaleString()}</small>{row.last_error_code==='sent_marker_failed'&&<small>{t('emailDeliveryUncertain')}</small>}</div>
        {canEdit&&row.last_error_code!=='sent_marker_failed'&&<button type="button" className="ghost-button" disabled={retrying!==null} onClick={()=>retry(row.id)}>{retrying===row.id?t('emailFailureRetrying'):t('emailFailureRetry')}</button>}
      </li>)}
    </ul>}
  </section>
}
