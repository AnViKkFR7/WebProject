import { describe, expect, it } from 'vitest'
import { normalizeReminders, reminderSendAt, toggleReminder } from './reminders'

describe('reminders — recordatorios por email', () => {
  it('quita duplicados, valores inventados y los deja ordenados', () => {
    expect(normalizeReminders([1440, 0, 1440, 7, 60])).toEqual([0, 60, 1440])
    expect(normalizeReminders(null)).toEqual([])
  })

  it('marcar y desmarcar', () => {
    expect(toggleReminder([], 60)).toEqual([60])
    expect(toggleReminder([0, 60], 60)).toEqual([0])
  })

  it('calcula el momento del envío a partir del inicio', () => {
    const start = '2026-07-15T10:00:00.000Z'
    expect(reminderSendAt(start, 0).toISOString()).toBe('2026-07-15T10:00:00.000Z')
    expect(reminderSendAt(start, 60).toISOString()).toBe('2026-07-15T09:00:00.000Z')
    expect(reminderSendAt(start, 10080).toISOString()).toBe('2026-07-08T10:00:00.000Z')
  })

  it('una fecha inválida no revienta', () => {
    expect(reminderSendAt('', 60)).toBeNull()
  })
})
