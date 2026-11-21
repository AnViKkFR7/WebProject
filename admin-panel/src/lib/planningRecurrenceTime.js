const hour=3600000,day=24*hour
const madrid=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
function wallStamp(date){
  const p=Object.fromEntries(madrid.formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]))
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)+date.getUTCMilliseconds()
}
function instant(stamp){
  if(!Number.isFinite(stamp))return new Date(NaN)
  const offsets=[...new Set([-day,0,day].map(delta=>{const probe=new Date(stamp+delta);return wallStamp(probe)-probe.getTime()}))]
  const matches=offsets.map(offset=>stamp-offset).filter(value=>wallStamp(new Date(value))===stamp)
  // PostgreSQL chooses standard time for ambiguous/nonexistent local timestamps.
  return new Date(matches.length?Math.max(...matches):stamp-Math.min(...offsets))
}
export function recurrenceOccurrence(start,type,every,index,dateOnly=false){
  if(index===0)return new Date(start)
  if(type==='hourly')return new Date(start.getTime()+every*index*hour)
  const stamp=dateOnly?start.getTime():wallStamp(start),date=new Date(stamp)
  if(type==='yearly'){
    const year=date.getUTCFullYear()+every*index,month=date.getUTCMonth()
    const last=new Date(Date.UTC(year,month+1,0)).getUTCDate()
    date.setUTCFullYear(year,month,Math.min(date.getUTCDate(),last))
  }else date.setTime(stamp+every*index*(type==='weekly'?7:1)*day)
  if(!Number.isFinite(date.getTime()))return date
  return dateOnly?date:instant(date.getTime())
}
