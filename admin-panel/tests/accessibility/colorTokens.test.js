import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'

const css=readFileSync(new URL('../../src/App.css',import.meta.url),'utf8')
const block=(selector)=>css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1]||''
const tokens=(content)=>Object.fromEntries([...content.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(([,name,value])=>[name,value]))
const light=tokens(block(':root'))
const dark={...light,...tokens(block("\\[data-theme='dark'\\]"))}
const luminance=color=>{
  const values=color.slice(1).match(/../g).map(pair=>parseInt(pair,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
  return .2126*values[0]+.7152*values[1]+.0722*values[2]
}
const contrast=(first,second)=>{
  const a=luminance(first),b=luminance(second)
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
}

it('keeps common text and action colors above WCAG AA in light and dark themes',()=>{
  expect(contrast(light['primary-color'],'#ffffff')).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#ffffff',light['primary-button-bg'])).toBeGreaterThanOrEqual(4.5)
  expect(contrast(light['text-tertiary'],'#ffffff')).toBeGreaterThanOrEqual(4.5)
  expect(contrast(light['text-tertiary'],light['bg-body'])).toBeGreaterThanOrEqual(4.5)
  expect(contrast(light['border-color'],light['bg-body'])).toBeGreaterThanOrEqual(3)
  expect(contrast(light['danger-color'],light['danger-bg'])).toBeGreaterThanOrEqual(4.5)
  expect(contrast(light['success-color'],light['success-bg'])).toBeGreaterThanOrEqual(4.5)

  expect(contrast(dark['primary-color'],dark['bg-card'])).toBeGreaterThanOrEqual(4.5)
  expect(contrast('#ffffff',dark['primary-button-bg'])).toBeGreaterThanOrEqual(4.5)
  expect(contrast(dark['text-tertiary'],dark['bg-card'])).toBeGreaterThanOrEqual(4.5)
  expect(contrast(dark['border-color'],dark['bg-card'])).toBeGreaterThanOrEqual(3)
  expect(contrast(dark['danger-color'],dark['danger-bg'])).toBeGreaterThanOrEqual(4.5)
  expect(contrast(dark['success-color'],dark['success-bg'])).toBeGreaterThanOrEqual(4.5)
})

it('keeps the global keyboard focus ring distinguishable from panel surfaces',()=>{
  expect(contrast(light['primary-color'],light['bg-body'])).toBeGreaterThanOrEqual(3)
  expect(contrast(light['primary-color'],light['bg-card'])).toBeGreaterThanOrEqual(3)
  expect(contrast(dark['primary-color'],dark['bg-body'])).toBeGreaterThanOrEqual(3)
  expect(contrast(dark['primary-color'],dark['bg-card'])).toBeGreaterThanOrEqual(3)
})
