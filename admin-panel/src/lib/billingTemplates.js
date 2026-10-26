let fallbackId=0
export const billingLineId=()=>globalThis.crypto?.randomUUID?.() || `line-${Date.now()}-${++fallbackId}`

export const withBillingLineIds=lines=>lines.map(line=>line.id ? {...line} : {...line,id:billingLineId()})

export function duplicateBillingDocument(document) {
  const copy=structuredClone(document)
  copy.date=''
  copy.dueDate=''
  delete copy.sourceQuote
  copy.lines=copyTemplateLines(copy.lines || [])
  return copy
}

export const copyTemplateLines=lines=>lines.map(line=>{
  const copy=structuredClone(line);delete copy.id
  return {...copy,id:billingLineId()}
})

export function applyChapterTemplate(current,template) {
  const incoming=copyTemplateLines(template)
  const onlyBlank=current.length===1 && !current[0].description?.trim()
  return onlyBlank ? incoming : [...withBillingLineIds(current),...incoming]
}

export function moveBillingChapter(lines,chapter,direction) {
  const order=[];const groups=new Map()
  withBillingLineIds(lines).forEach(line=>{
    const key=line.chapter?.trim() || ''
    if(!groups.has(key)){groups.set(key,[]);order.push(key)}
    groups.get(key).push(line)
  })
  const from=order.indexOf(chapter);const to=from+direction
  if(from<0 || to<0 || to>=order.length)return withBillingLineIds(lines)
  ;[order[from],order[to]]=[order[to],order[from]]
  return order.flatMap(key=>groups.get(key))
}

export function moveBillingLine(lines,id,direction) {
  const next=withBillingLineIds(lines);const from=next.findIndex(line=>line.id===id)
  if(from<0)return next
  const chapter=next[from].chapter?.trim() || ''
  const peers=next.map((line,index)=>({line,index})).filter(entry=>(entry.line.chapter?.trim() || '')===chapter)
  const position=peers.findIndex(entry=>entry.index===from);const target=peers[position+direction]?.index
  if(target===undefined)return next
  ;[next[from],next[target]]=[next[target],next[from]]
  return next
}
