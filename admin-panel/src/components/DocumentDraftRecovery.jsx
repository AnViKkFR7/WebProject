import { useEffect, useImperativeHandle, useState } from 'react'
import { DocumentDraftSession } from '../lib/documentDraftSession'
import { loadDocumentDraft, saveDocumentDraft, deleteDocumentDraft } from '../services/documentDraftService'
import DocumentActionButton from './ui/DocumentActionButton'
import styles from './DocumentDraftRecovery.module.css'

export default function DocumentDraftRecovery({ref,scope,document,baseVersion,onRecover,onOpenCompleted,onProtectionChange,onGateChange,t}) {
  const [info,setInfo]=useState({status:'loading',candidates:{}})
  const [session]=useState(()=>new DocumentDraftSession({scope,document,baseVersion,service:{load:loadDocumentDraft,save:saveDocumentDraft,remove:deleteDocumentDraft},onChange:value=>{setInfo(value);onProtectionChange(value.protectedFingerprint);onGateChange(value.gate)},onRecover}))
  useEffect(()=>{session.start();return()=>session.destroy()},[session])
  useEffect(()=>{session.setRecoveryHandler(onRecover)},[session,onRecover])
  useEffect(()=>{session.update(document)},[document,session])
  useEffect(()=>{
    const backup=()=>session.backup()
    const online=()=>{if(['offline','error'].includes(session.status) && session.ready)session.saveNow().catch(()=>{})}
    const logout=()=>{session.complete();session.destroy()}
    window.addEventListener('beforeunload',backup);window.addEventListener('pagehide',backup);window.addEventListener('online',online);window.addEventListener('billing-recovery-cleared',logout)
    return()=>{window.removeEventListener('beforeunload',backup);window.removeEventListener('pagehide',backup);window.removeEventListener('online',online);window.removeEventListener('billing-recovery-cleared',logout)}
  },[session])
  useImperativeHandle(ref,()=>({prepare:document=>session.prepare(document),complete:()=>session.complete(),failed:error=>session.failed(error)}),[session])
  const candidates=Object.entries(info.candidates)
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(Object.fromEntries(candidates),null,2)],{type:'application/json'}))
    const link=window.document.createElement('a');link.href=url;link.download=`${scope.kind}-recovery.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <div className={styles.panel}>
    <p role="status" className={styles.status}>{t(`documentAutosave.${info.status}`)}</p>
    {info.localUnavailable && <p className="field-help">{t('documentAutosave.localUnavailable')}</p>}
    {candidates.length>0 && <div className={styles.recovery}>
      <p>{t('documentAutosave.recoveryHelp')}</p>
      {candidates.map(([source,candidate])=><div key={source}>
        <DocumentActionButton variant="outline" disabled={info.busy || candidate.completed || candidate.baseVersion!==baseVersion} onClick={()=>session.recover(source)}>{t(`documentAutosave.recover${source==='local' ? 'Local' : 'Remote'}`)}</DocumentActionButton>
        {candidate.completed && <p>{t('documentAutosave.alreadyCommitted')}</p>}
        {candidate.baseVersion!==baseVersion && <p className="field-error">{t('documentAutosave.sourceChanged')}</p>}
      </div>)}
      <DocumentActionButton variant="outline" onClick={download}>{t('documentAutosave.export')}</DocumentActionButton>
      {info.completedRecord && info.candidates.local?.completed && <DocumentActionButton onClick={()=>onOpenCompleted(info.completedRecord)}>{t('documentAutosave.openCommitted')}</DocumentActionButton>}
      <DocumentActionButton variant="danger" disabled={!info.ready || info.busy} onClick={()=>session.discard()}>{t('documentAutosave.discard')}</DocumentActionButton>
    </div>}
    {['error','offline','unavailable'].includes(info.status) && <DocumentActionButton variant="outline" onClick={()=>session.ready ? session.saveNow().catch(()=>{}) : session.initialize()}>{t('documentAutosave.retry')}</DocumentActionButton>}
    {info.status==='conflict' && <div><p>{t('documentAutosave.conflictHelp')}</p><DocumentActionButton variant="outline" onClick={()=>session.initialize()}>{t('documentAutosave.reviewVersions')}</DocumentActionButton></div>}
  </div>
}
