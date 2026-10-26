import {describe,it,expect} from 'vitest'
import {movedPlanningTask} from './planningTaskMove'

describe('planning task movement',()=>{
  it('moves an occurrence and its duration while preserving the local wall-clock across days',()=>{
    expect(movedPlanningTask({start_datetime:'2026-10-26T09:00:00Z',end_datetime:'2026-10-26T10:00:00Z'},{deltaDays:2,deltaMinutes:30,resizeMinutes:30}))
      .toEqual({start_datetime:'2026-10-28T09:30:00.000Z',end_datetime:'2026-10-28T11:00:00.000Z'})
  })
  it('moves the whole series from its master date, not from the visible occurrence date',()=>{
    expect(movedPlanningTask({_seriesStart:'2026-01-01T09:00:00Z',_seriesEnd:'2026-01-01T10:00:00Z',start_datetime:'2026-10-01T09:00:00Z',end_datetime:'2026-10-01T10:00:00Z'},{deltaDays:1}))
      .toEqual({start_datetime:'2026-01-02T09:00:00.000Z',end_datetime:'2026-01-02T10:00:00.000Z'})
  })
})
