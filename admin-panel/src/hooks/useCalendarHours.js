import { useLayoutEffect, useRef, useState } from 'react'

export default function useCalendarHours(fullDay=false) {
  const scrollRef=useRef(null)
  const [height,setHeight]=useState(480)
  useLayoutEffect(()=>{
    const node=scrollRef.current
    if(!node) return
    const measure=()=>setHeight(Math.max(1,node.clientHeight || 480))
    measure()
    const observer=typeof ResizeObserver!=='undefined' ? new ResizeObserver(measure) : null
    observer?.observe(node)
    window.addEventListener('resize',measure)
    return ()=>{observer?.disconnect();window.removeEventListener('resize',measure)}
  },[])
  useLayoutEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=0},[fullDay])
  const firstHour=fullDay ? 0 : 8
  const lastHour=fullDay ? 24 : 20
  const hourHeight=fullDay ? 48 : height/(lastHour-firstHour)
  return {scrollRef,firstHour,lastHour,hourHeight,hours:Array.from({length:lastHour-firstHour},(_,index)=>firstHour+index)}
}
