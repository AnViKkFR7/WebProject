import { useEffect } from 'react'

export default function ButtonTooltipManager(){
  useEffect(()=>{
    const getLabel=button=>{
      const labelledBy=button.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent||'').join(' ')
      const associatedLabels=Array.from(button.labels||[]).map(label=>label.querySelector(':scope > span')?.textContent||label.textContent||'').join(' ')
      return (button.getAttribute('aria-label')||labelledBy||button.querySelector('svg[role="img"][aria-label]')?.getAttribute('aria-label')||button.querySelector('svg title')?.textContent||associatedLabels||button.textContent||'').replace(/\s+/g,' ').trim()
    }
    const enrichButtons=root=>root.querySelectorAll?.('button').forEach(button=>{
      if(button.hasAttribute('title')&&!button.hasAttribute('data-auto-tooltip'))return
      const label=getLabel(button)
      if(!label)return
      if(button.title!==label)button.title=label
      if(!button.hasAttribute('aria-label')&&!button.textContent.trim()&&button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label)
      button.setAttribute('data-auto-tooltip','true')
    })
    enrichButtons(document)
    const observer=new MutationObserver(records=>records.forEach(record=>{
      if(record.type==='childList')record.addedNodes.forEach(node=>{
        if(node instanceof HTMLElement){if(node.matches('button'))enrichButtons({querySelectorAll:()=>[node]});enrichButtons(node)}
      })
      if(record.type==='characterData'&&record.target.parentElement?.closest('button'))enrichButtons({querySelectorAll:()=>[record.target.parentElement.closest('button')]})
      if(record.type==='attributes'&&record.attributeName==='aria-label'&&record.target instanceof HTMLButtonElement)enrichButtons({querySelectorAll:()=>[record.target]})
    }))
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label']})
    return()=>observer.disconnect()
  },[])
  return null
}
