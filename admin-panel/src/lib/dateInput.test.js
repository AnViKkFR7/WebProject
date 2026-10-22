import { describe, it, expect } from 'vitest'
import { calendarDate, displayDateInput, parseDateInput, taskHourLater, changeTaskStart } from './dateInput'
describe('date input and task duration',()=>{
  it('validates real calendar dates, including leap years and manually typed dates',()=>{
    expect(parseDateInput('29/02/2028')).toBe('2028-02-29')
    expect(parseDateInput('31122026')).toBe('2026-12-31')
    expect(parseDateInput('2026-10-22')).toBe('2026-10-22')
    expect(parseDateInput('31/04/2026')).toBeNull()
    expect(parseDateInput('29/02/2026')).toBeNull()
    expect(parseDateInput('22/1')).toBeNull()
    expect(parseDateInput('')).toBe('')
    expect(calendarDate('0000-01-01')).toBeNull()
    expect(displayDateInput('2026-10-22')).toBe('22/10/2026')
  })
  it('suggests the next hour across midnight, months, years and daylight saving changes',()=>{
    expect(taskHourLater('2026-12-31T23:30')).toBe('2027-01-01T00:30')
    expect(taskHourLater('2028-02-29T23:15')).toBe('2028-03-01T00:15')
    expect(taskHourLater('2026-10-25T02:30')).toBe('2026-10-25T03:30')
    expect(taskHourLater('')).toBe('')
  })
  it('tracks an automatic end while the start is edited repeatedly',()=>{
    let form={start_datetime:'',end_datetime:''}
    form=changeTaskStart(form,'2026-10-22T09:00')
    expect(form.end_datetime).toBe('2026-10-22T10:00')
    form=changeTaskStart(form,'2026-10-22T15:30')
    expect(form.end_datetime).toBe('2026-10-22T16:30')
    form=changeTaskStart(form,'2026-10-23T23:00')
    expect(form.end_datetime).toBe('2026-10-24T00:00')
  })
  it('preserves valid custom ends and repairs an end overtaken by the start',()=>{
    const form={start_datetime:'2026-10-22T09:00',end_datetime:'2026-10-22T14:00'}
    expect(changeTaskStart(form,'2026-10-22T12:00').end_datetime).toBe('2026-10-22T14:00')
    expect(changeTaskStart(form,'2026-10-22T15:00').end_datetime).toBe('2026-10-22T16:00')
    expect(changeTaskStart(form,'').end_datetime).toBe('')
  })
})
