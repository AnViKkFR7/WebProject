const object=value=>value!==null && typeof value==='object' && !Array.isArray(value)
const text=(value,max=2000)=>typeof value==='string' && value.length<=max
const scalar=value=>text(value) || (typeof value==='number' && Number.isFinite(value))
export function isDraftDocument(doc) {
  if(!object(doc) || !object(doc.issuer) || !object(doc.customer) || !Array.isArray(doc.lines) || doc.lines.length>1000)return false
  if(!Object.entries(doc.issuer).every(([key,value])=>key==='logo' ? text(value,1400000) && (!value || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value)) : key==='palette' ? object(value) && Object.values(value).every(item=>text(item,32)) && JSON.stringify(value).length<=1000 : text(value)))return false
  if(!Object.values(doc.customer).every(value=>text(value)) || !doc.lines.every(line=>object(line) && Object.values(line).every(scalar)))return false
  if(!Object.entries(doc).every(([key,value])=>['issuer','customer','lines'].includes(key) || (key==='presentation' ? object(value) && Object.values(value).every(item=>text(item) || typeof item==='boolean') : scalar(value))))return false
  return new TextEncoder().encode(JSON.stringify(doc)).length<=2000000
}
const ordered=value=>Array.isArray(value) ? value.map(ordered) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])) : value
export const draftFingerprint=doc=>JSON.stringify(ordered(doc))
export const draftScopeKey=scope=>`moira.billingRecovery.v1.${[scope.userId,scope.companyId,scope.kind,scope.key].map(encodeURIComponent).join('.')}`
const prefix='moira.billingRecovery.v1.'
const day=24*60*60*1000
export function readDraftRecovery(scope,storage,now=Date.now()) {
  try {
    storage ||= globalThis.sessionStorage
    const key=draftScopeKey(scope),entry=JSON.parse(storage.getItem(key) || 'null')
    if(!entry)return null
    if(entry.schema!==1 || !Number.isFinite(entry.expiresAt) || entry.expiresAt<=now || !['userId','companyId','kind','key'].every(part=>entry.scope?.[part]===scope[part]) || !isDraftDocument(entry.document)) {storage.removeItem(key);return null}
    return entry
  } catch {return null}
}
export function writeDraftRecovery(scope,entry,storage,now=Date.now()) {
  try {
    storage ||= globalThis.sessionStorage
    if(!isDraftDocument(entry.document))return false
    const key=draftScopeKey(scope),value=JSON.stringify({...entry,schema:1,scope,updatedAt:now,expiresAt:now+day})
    const saved=[]
    for(let index=0;index<storage.length;index++) {
      const other=storage.key(index)
      if(other?.startsWith(prefix) && other!==key) saved.push([other,storage.getItem(other)])
    }
    saved.sort((a,b)=>{try{return JSON.parse(a[1]).updatedAt-JSON.parse(b[1]).updatedAt}catch{return 0}})
    let total=value.length*2+saved.reduce((sum,item)=>sum+item[1].length*2,0),count=saved.length
    for(const [other,data] of saved) {
      let expired=true
      try{expired=JSON.parse(data).expiresAt<=now}catch{ /* Malformed recovery entries can be removed. */ }
      if(expired || total>3*1024*1024 || count>=10) {storage.removeItem(other);total-=data.length*2;count--}
    }
    if(total>3*1024*1024)return false
    storage.setItem(key,value);return true
  } catch {return false}
}
export function removeDraftRecovery(scope,storage) {try{(storage || globalThis.sessionStorage).removeItem(draftScopeKey(scope))}catch{ /* Recovery storage may be unavailable. */ }}
export function clearDraftRecovery(storage) {
  globalThis.window?.dispatchEvent(new Event('billing-recovery-cleared'))
  try {storage ||= globalThis.sessionStorage;for(let index=storage.length-1;index>=0;index--){const key=storage.key(index);if(key?.startsWith(prefix))storage.removeItem(key)}}catch{ /* Sign-out must not depend on storage availability. */ }
}
