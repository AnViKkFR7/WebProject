import {it,expect} from 'vitest'
import {layoutCalendarEvents,calendarEventBox,minuteFromClick} from './calendarGrid'
it('creates slots at the displayed hour rather than midnight in the business range',()=>{
  expect(minuteFromClick(0,40,8)).toEqual({h:8,m:0})
  expect(minuteFromClick(40,40,8)).toEqual({h:9,m:0})
  expect(minuteFromClick(450,40,8)).toEqual({h:19,m:15})
})
it('keeps chained overlapping cards inside their day and separates independent groups',()=>{
  const layout=layoutCalendarEvents([{_start:8,_end:12},{_start:9,_end:11},{_start:10,_end:14},{_start:12,_end:15},{_start:16,_end:17}])
  for(const event of layout)expect(event._col).toBeLessThan(event._totalCols)
  expect(layout[0]._totalCols).toBe(3)
  expect(layout.at(-1)._totalCols).toBe(1)
})
it('clips partial events to the visible range and keeps late short cards clickable',()=>{
  expect(calendarEventBox({_start:7*60,_end:9*60},8,20,40).top).toBe(1)
  const late=calendarEventBox({_start:19*60+59,_end:20*60+30},8,20,40)
  expect(late.height).toBeGreaterThanOrEqual(16)
  expect(late.top+late.height).toBeLessThanOrEqual(480)
})
