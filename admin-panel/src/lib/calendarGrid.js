/** Minuto del día (en pasos de 15) a partir del punto donde se clica la rejilla */
export function minuteFromClick(offsetY, hourHeight, firstHour=0) {
  const h = Math.min(Math.max(firstHour + Math.floor(offsetY / hourHeight), 0), 23)
  const m = Math.min(Math.round(((offsetY % hourHeight) / hourHeight) * 60 / 15) * 15, 45)
  return { h, m }
}

// Connected overlap groups share one column count, so chained overlaps never
// push the final event outside its day column.
export function layoutCalendarEvents(events) {
  const sorted=[...events].sort((a,b)=>a._start-b._start || a._end-b._end)
  const result=[]
  let group=[];let until=-Infinity
  const flush=()=>{
    const ends=[]
    const placed=group.map(event=>{
      let col=ends.findIndex(end=>end<=event._start)
      if(col<0){col=ends.length;ends.push(event._end)} else ends[col]=event._end
      return {...event,_col:col}
    })
    result.push(...placed.map(event=>({...event,_totalCols:ends.length})))
    group=[]
  }
  for(const event of sorted) {
    if(group.length && event._start>=until){flush();until=-Infinity}
    group.push(event);until=Math.max(until,event._end)
  }
  if(group.length)flush()
  return result
}
export function calendarEventBox(event,firstHour,lastHour,hourHeight) {
  const grid=(lastHour-firstHour)*hourHeight
  const minHeight=Math.min(16,grid)
  const top=Math.min((Math.max(event._start,firstHour*60)-firstHour*60)*hourHeight/60+1,grid-minHeight)
  const height=Math.min(Math.max((Math.min(event._end,lastHour*60)-Math.max(event._start,firstHour*60))*hourHeight/60-2,minHeight),grid-top)
  return {top,height}
}
