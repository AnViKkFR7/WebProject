import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { addDays, addMonths, startOfWeek } from 'date-fns'
import { useLanguage } from '../contexts/LanguageContext'
import { calendarDate, calendarISO, displayDateInput, parseDateInput } from '../lib/dateInput'
import Icon from './ui/Icon'
import '../styles/datePicker.css'

// One editable date control throughout the panel. Stored values always stay ISO.
export default function DatePicker({ value='',onChange,disabled=false,required=false,min,max,id,label,...inputProps }) {
  const {t,language}=useLanguage()
  const generatedId=useId()
  const inputId=id || generatedId
  const locale=language === 'en' ? 'en-GB' : 'es-ES'
  const [open,setOpen]=useState(false)
  const [month,setMonth]=useState(()=>calendarDate(value) || new Date())
  const [focused,setFocused]=useState(value || calendarISO(new Date()))
  const [position,setPosition]=useState({})
  const [draft,setDraft]=useState(null)
  const wrapper=useRef(null)
  const panel=useRef(null)
  const input=useRef(null)
  const trigger=useRef(null)
  const shown=draft?.source === value ? draft.text : displayDateInput(value)
  const allowed=iso=>Boolean(calendarDate(iso)) && (!min || iso>=min) && (!max || iso<=max)
  const invalidText=iso=>iso===null ? t('dateInput.invalid') : iso && !allowed(iso) ? t('dateInput.range') : ''

  useEffect(()=>{ input.current?.setCustomValidity(invalidText(parseDateInput(shown))) })
  useLayoutEffect(()=>{
    if (!open) return
    if(panel.current?.showPopover && !panel.current.matches(':popover-open')) panel.current.showPopover()
    const node=panel.current
    const anchor=trigger.current?.getBoundingClientRect()
    if(node && anchor) {
      const height=node.getBoundingClientRect().height
      const below=window.innerHeight-anchor.bottom
      node.style.top=`${below>=height+8 ? anchor.bottom+8 : anchor.top>=height+20 ? anchor.top-height-8 : Math.max(12,Math.min(anchor.bottom+8,window.innerHeight-height-12))}px`
    }
    node?.querySelector('[data-focused="true"]')?.focus()
  },[open])
  useEffect(()=>{
    if (!open) return
    const outside=event=>{ if(!wrapper.current?.contains(event.target)) setOpen(false) }
    const escape=event=>{ if(event.key==='Escape') {event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus()} }
    const close=()=>setOpen(false)
    const node=wrapper.current
    document.addEventListener('pointerdown',outside)
    node?.addEventListener('keydown',escape)
    window.addEventListener('resize',close)
    // Keep the floating calendar aligned when its surrounding form scrolls.
    const scroll=event=>{if(!panel.current?.contains(event.target)) close()}
    document.addEventListener('scroll',scroll,true)
    return ()=>{document.removeEventListener('pointerdown',outside);node?.removeEventListener('keydown',escape);window.removeEventListener('resize',close);document.removeEventListener('scroll',scroll,true)}
  },[open])
  const choose=iso=>{
    if(iso && !allowed(iso)) return
    setDraft(null);onChange(iso);input.current?.setCustomValidity('');setOpen(false);trigger.current?.focus()
  }
  const show=()=>{
    if(open) {setOpen(false);return}
    const anchor=trigger.current.getBoundingClientRect()
    const width=Math.min(320,window.innerWidth-24)
    const height=Math.min(480,window.innerHeight-24)
    const below=window.innerHeight-anchor.bottom
    const top=below>=height+8 ? anchor.bottom+8 : Math.max(12,anchor.top-height-8)
    setPosition({left:Math.max(12,Math.min(anchor.right-width,window.innerWidth-width-12)),top,width,maxHeight:height})
    const candidate=calendarDate(value) || new Date()
    const iso=calendarISO(candidate)
    const start=(min && iso<min ? calendarDate(min) : max && iso>max ? calendarDate(max) : candidate) || candidate
    setMonth(start);setFocused(calendarISO(start));setOpen(true)
  }
  const selectMonth=next=>{setMonth(next);setFocused(calendarISO(next))}
  const moveMonth=delta=>selectMonth(addMonths(month,delta))
  const keyDay=event=>{
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}
    let next
    if(event.key in offsets) next=addDays(calendarDate(focused),offsets[event.key])
    else if(event.key==='Home') next=startOfWeek(calendarDate(focused),{weekStartsOn:1})
    else if(event.key==='End') next=addDays(startOfWeek(calendarDate(focused),{weekStartsOn:1}),6)
    else if(event.key==='PageUp' || event.key==='PageDown') next=addMonths(calendarDate(focused),event.key==='PageUp' ? -1 : 1)
    if(!next) return
    event.preventDefault()
    const iso=calendarISO(next)
    if(!allowed(iso)) return
    setMonth(next);setFocused(iso)
    requestAnimationFrame(()=>panel.current?.querySelector(`[data-date="${iso}"]`)?.focus())
  }
  const first=new Date(month.getFullYear(),month.getMonth(),1)
  first.setFullYear(month.getFullYear())
  const start=startOfWeek(first,{weekStartsOn:1})
  const today=calendarISO(new Date())
  const days=Array.from({length:42},(_,index)=>addDays(start,index))
  const name=label || inputProps['aria-label'] || t('dateInput.date')
  return <div className="calendar-field" ref={wrapper} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}>
    <div className="calendar-input-row">
      <input {...inputProps} ref={input} id={inputId} type="text" className="input calendar-text-input" inputMode="numeric" autoComplete="off" maxLength={10}
        aria-label={name} disabled={disabled} required={required} value={shown} placeholder={t('dateInput.placeholder')}
        onChange={event=>{
          const raw=event.target.value
          setDraft({source:value,text:raw})
          const parsed=parseDateInput(raw)
          input.current.setCustomValidity(invalidText(parsed))
          if(parsed!==null && (!parsed || allowed(parsed))) onChange(parsed)
        }}
        onBlur={()=>{const parsed=parseDateInput(shown);if(parsed!==null && (!parsed || allowed(parsed))) setDraft(null)}}
        onKeyDown={event=>{if(event.key==='ArrowDown' && event.altKey) {event.preventDefault();show()} }}/>
      <button ref={trigger} type="button" className="calendar-open" disabled={disabled} onClick={show} aria-expanded={open} aria-controls={open ? `${inputId}-calendar` : undefined} aria-label={`${t('dateInput.open')}: ${name}`}><Icon name="planning" size={17}/></button>
    </div>
    {open && <div ref={panel} id={`${inputId}-calendar`} className="calendar-popover" popover="manual" style={position} role="dialog" aria-label={`${t('dateInput.select')}: ${name}`}>
      <div className="calendar-heading"><span>{t('dateInput.select')}</span><button type="button" className="calendar-icon-button" aria-label={t('common.close')} onClick={()=>{setOpen(false);trigger.current?.focus()}}><Icon name="close" size={16}/></button></div>
      <div className="calendar-month-nav">
        <button type="button" className="calendar-icon-button" aria-label={t('dateInput.previous')} disabled={month.getFullYear()===1 && month.getMonth()===0} onClick={()=>moveMonth(-1)}>‹</button>
        <select className="select" aria-label={t('dateInput.month')} value={month.getMonth()} onChange={event=>{const next=new Date(month);next.setDate(1);next.setMonth(Number(event.target.value));selectMonth(next)}}>
          {Array.from({length:12},(_,index)=><option key={index} value={index}>{new Date(2026,index,1).toLocaleDateString(locale,{month:'long'})}</option>)}
        </select>
        <input className="input" type="number" aria-label={t('dateInput.year')} min="1" max="9999" value={month.getFullYear()} onChange={event=>{const year=Number(event.target.value);if(year>=1 && year<=9999){const next=new Date(month);next.setDate(1);next.setFullYear(year);selectMonth(next)}}}/>
        <button type="button" className="calendar-icon-button" aria-label={t('dateInput.next')} disabled={month.getFullYear()===9999 && month.getMonth()===11} onClick={()=>moveMonth(1)}>›</button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">{Array.from({length:7},(_,index)=><span key={index}>{addDays(new Date(2026,9,19),index).toLocaleDateString(locale,{weekday:'short'}).replace('.','')}</span>)}</div>
      <div className="calendar-days" role="group" aria-label={month.toLocaleDateString(locale,{month:'long',year:'numeric'})} onKeyDown={keyDay}>
        {days.map(day=>{const iso=calendarISO(day);return <button key={iso} type="button" data-date={iso} data-focused={iso===focused} tabIndex={iso===focused ? 0 : -1} disabled={!allowed(iso)}
          className={`calendar-day${day.getMonth()!==month.getMonth() ? ' calendar-muted' : ''}${iso===value ? ' calendar-selected' : ''}${iso===today ? ' calendar-today' : ''}`}
          onFocus={()=>setFocused(iso)} aria-label={day.toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} aria-pressed={iso===value} aria-current={iso===today ? 'date' : undefined} onClick={()=>choose(iso)}>{day.getDate()}</button>})}
      </div>
      <div className="calendar-shortcuts"><button type="button" disabled={!allowed(today)} onClick={()=>choose(today)}>{t('dateInput.today')}</button><button type="button" disabled={!allowed(calendarISO(addDays(new Date(),1)))} onClick={()=>choose(calendarISO(addDays(new Date(),1)))}>{t('dateInput.tomorrow')}</button>{!required && <button type="button" onClick={()=>choose('')}>{t('dateInput.clear')}</button>}</div>
      <p className="calendar-hint">{t('dateInput.hint')}</p>
    </div>}
  </div>
}
