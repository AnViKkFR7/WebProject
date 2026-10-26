import {expect,it} from 'vitest'
import {toLocalDateInputValue} from './dates'

it('formats date-only controls using the local calendar day',()=>{
  const localMidnight=new Date(2026,9,24,0,30)
  expect(toLocalDateInputValue(localMidnight)).toBe('2026-10-24')
})
