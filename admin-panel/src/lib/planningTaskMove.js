import { addDays, addMinutes } from 'date-fns'

export function movedPlanningTask(task,{deltaMinutes=0,deltaDays=0,resizeMinutes=0}) {
  const sourceStart=new Date(task._seriesStart || task.start_datetime)
  const sourceEndValue=task._seriesEnd ?? task.end_datetime
  const sourceEnd=sourceEndValue ? new Date(sourceEndValue) : null
  if(Number.isNaN(sourceStart.getTime()) || (sourceEnd && Number.isNaN(sourceEnd.getTime()))) throw new Error('Invalid task dates')
  let start=addMinutes(addDays(sourceStart,deltaDays),deltaMinutes)
  let end=sourceEnd ? addMinutes(addDays(sourceEnd,deltaDays),deltaMinutes+resizeMinutes) : null
  if(end && end<=start) end=new Date(start.getTime()+15*60_000)
  return {start_datetime:start.toISOString(),end_datetime:end?.toISOString() ?? null}
}
