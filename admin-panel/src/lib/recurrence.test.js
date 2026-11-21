import {afterEach,expect,it,vi} from 'vitest'
import {expandRecurringItem,expandRecurringBills,expandRecurringTasks} from './recurrence'
import {recurrenceOccurrence} from './planningRecurrenceTime'
const task={id:'series',start_datetime:'2020-01-01T09:00:00Z',end_datetime:'2020-01-01T10:00:00Z',recurrence_type:'daily',recurrence_value:1}
afterEach(()=>vi.useRealTimers())
it('finds old daily and hourly series directly in the requested range beyond 200 occurrences',()=>{
  const range={from:'2026-10-01T00:00:00Z',to:'2026-10-31T23:59:59Z'}
  const daily=expandRecurringTasks([task],range)
  expect(daily).toHaveLength(31);expect(daily[0]._occurrenceKey).not.toBe('series::0')
  expect(daily[0]._seriesStart).toBe(task.start_datetime)
  expect(new Date(daily[0].end_datetime)-new Date(daily[0].start_datetime)).toBe(3600000)
  const hourly=expandRecurringTasks([{...task,recurrence_type:'hourly'}],range)
  expect(hourly).toHaveLength(31*24)
})
it('keeps keys stable across overlapping views and does not substitute an out-of-window master',()=>{
  const a=expandRecurringTasks([task],{from:'2026-10-01',to:'2026-10-03'})
  const b=expandRecurringTasks([task],{from:'2026-10-02',to:'2026-10-03'})
  expect(a[1]._occurrenceKey).toBe(b[0]._occurrenceKey)
  expect(expandRecurringTasks([{...task,start_datetime:'2030-01-01T09:00:00Z'}],{from:'2026-10-01',to:'2026-10-03'})).toEqual([])
})
it('matches Madrid daylight-saving rules and elapsed-time hourly steps',()=>{
  expect(recurrenceOccurrence(new Date('2026-03-28T01:30:00Z'),'daily',1,1).toISOString()).toBe('2026-03-29T01:30:00.000Z')
  expect(recurrenceOccurrence(new Date('2026-10-24T00:30:00Z'),'daily',1,1).toISOString()).toBe('2026-10-25T01:30:00.000Z')
  expect(recurrenceOccurrence(new Date('2026-03-28T09:00:00Z'),'daily',1,1).toISOString()).toBe('2026-03-29T08:00:00.000Z')
  expect(recurrenceOccurrence(new Date('2026-03-29T00:30:00Z'),'hourly',1,2).toISOString()).toBe('2026-03-29T02:30:00.000Z')
})
it('handles leap years and date-only billing without a lifetime horizon',()=>{
  const bill={id:'bill',billing_date:'2020-02-29',recurrence_type:'yearly',recurrence_value:1}
  expect(expandRecurringBills([bill],{from:'2025-02-01',to:'2025-02-28'})[0].billing_date).toBe('2025-02-28')
  expect(expandRecurringBills([bill],{from:'2040-02-01',to:'2040-02-29'})[0].billing_date).toBe('2040-02-29')
})
it('retains nonrecurring items, validates the window and uses a bounded default month',()=>{
  expect(expandRecurringItem({...task,recurrence_type:'none'})).toEqual([{...task,recurrence_type:'none'}])
  expect(()=>expandRecurringTasks([task],{from:'2020-01-01',to:'2026-01-01'})).toThrow('Invalid recurrence window')
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  expect(expandRecurringTasks([task]).length).toBeGreaterThan(30)
})
