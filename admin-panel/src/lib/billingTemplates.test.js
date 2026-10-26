import {describe,expect,it} from 'vitest'
import {applyChapterTemplate,duplicateBillingDocument,moveBillingChapter,moveBillingLine,withBillingLineIds} from './billingTemplates'

const lines=()=>[
  {id:'a',chapter:'01 · Inicio',description:'A',quantity:1,price:10,discount:0,tax:21},
  {id:'b',chapter:'01 · Inicio',description:'B',quantity:1,price:20,discount:0,tax:21},
  {id:'c',chapter:'02 · Final',description:'C',quantity:1,price:30,discount:0,tax:21},
]
describe('billing document copies and chapter templates',()=>{
  it('duplicates content while clearing dates, source and line identities',()=>{
    const source={date:'2026-10-24',dueDate:'2026-11-24',sourceQuote:'P-1',customer:{name:'A'},lines:lines()}
    const copy=duplicateBillingDocument(source)
    expect(copy).toMatchObject({date:'',dueDate:'',customer:{name:'A'}})
    expect(copy.sourceQuote).toBeUndefined();expect(copy.lines.map(line=>line.id)).not.toEqual(['a','b','c'])
    expect(source.date).toBe('2026-10-24')
  })
  it('applies a template as independent editable lines',()=>{
    const current=[{description:'',quantity:1,price:0,discount:0,tax:21}]
    const applied=applyChapterTemplate(current,lines())
    expect(applied.map(line=>line.description)).toEqual(['A','B','C'])
    expect(new Set(applied.map(line=>line.id)).size).toBe(3)
    expect(applied.map(line=>line.id)).not.toEqual(['a','b','c'])
  })
  it('reorders chapters and items without changing stable ids',()=>{
    expect(moveBillingChapter(lines(),'02 · Final',-1).map(line=>line.id)).toEqual(['c','a','b'])
    expect(moveBillingLine(lines(),'b',-1).map(line=>line.id)).toEqual(['b','a','c'])
    expect(withBillingLineIds(lines()).map(line=>line.id)).toEqual(['a','b','c'])
  })
})
