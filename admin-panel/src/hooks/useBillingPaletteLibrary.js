import { useEffect, useRef, useState } from 'react'
import { loadBillingPalettes, saveBillingPalette } from '../services/billingPaletteService'

export function useBillingPaletteLibrary(companyId,canEdit) {
  const [entries,setEntries]=useState([])
  const [status,setStatus]=useState('loading')
  const [saveError,setSaveError]=useState('')
  const [saving,setSaving]=useState(false)
  const [revision,setRevision]=useState(0)
  const active=useRef(false)
  const pending=useRef(false)
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
  useEffect(()=>{
    let current=true
    if(!companyId){setEntries([]);setStatus('ready');return()=>{current=false}}
    loadBillingPalettes(companyId).then(rows=>{if(current){setEntries(rows);setStatus('ready')}})
      .catch(()=>{if(current)setStatus('error')})
    return()=>{current=false}
  },[companyId,revision])
  const save=async(name,palette)=>{
    if(!canEdit || pending.current || !active.current) return null
    pending.current=true;setSaving(true);setSaveError('')
    try {
      const entry=await saveBillingPalette(companyId,name,structuredClone(palette))
      if(!active.current) return null
      setEntries(previous=>[...previous.filter(row=>row.id!==entry.id),entry].sort((a,b)=>a.name.localeCompare(b.name)))
      return entry
    } catch(error) {
      if(active.current)setSaveError(error.code==='23505' ? 'duplicate' : 'saveError')
      return null
    } finally {
      pending.current=false
      if(active.current)setSaving(false)
    }
  }
  return {entries,status,saveError,saving,canEdit,save,reload:()=>{setStatus('loading');setRevision(value=>value+1)}}
}
