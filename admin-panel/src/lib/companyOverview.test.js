import { describe, expect, it } from 'vitest'
import {
  countBy, distinctItemTypes, ITEM_STATUSES, MEMBER_ROLES, nextTasks, percentOf, sumBilling,
} from './companyOverview'

describe('companyOverview — recuentos del Dashboard', () => {
  it('cuenta los items por estado y deja a 0 los que no aparecen', () => {
    const items = [{ status: 'draft' }, { status: 'published' }, { status: 'published' }]
    expect(countBy(items, 'status', ITEM_STATUSES)).toEqual({ draft: 1, published: 2, archived: 0 })
  })

  it('cuenta los miembros por rol', () => {
    const members = [{ role: 'admin' }, { role: 'viewer' }, { role: 'viewer' }]
    expect(countBy(members, 'role', MEMBER_ROLES)).toEqual({ admin: 1, editor: 0, viewer: 2 })
  })

  it('una lista vacía no rompe', () => {
    expect(countBy(null, 'status', ITEM_STATUSES)).toEqual({ draft: 0, published: 0, archived: 0 })
  })

  it('separa lo que se cobra de lo que se paga', () => {
    const bills = [
      { direction: 'cobrar', amount: '1200.50' },
      { direction: 'pagar', amount: 300 },
      { direction: 'cobrar', amount: null },
    ]
    expect(sumBilling(bills)).toEqual({ toReceive: 1200.5, toPay: 300, balance: 900.5 })
  })

  it('lista los tipos de item sin repetirlos', () => {
    expect(distinctItemTypes([{ item_type: 'Piso' }, { item_type: 'Piso' }, { item_type: 'Local' }]))
      .toEqual(['Piso', 'Local'])
  })

  it('las próximas tareas descartan las pasadas y van en orden', () => {
    const now = new Date('2026-10-22T10:00:00Z')
    const tasks = [
      { id: 'pasada', start_datetime: '2026-10-21T10:00:00Z' },
      { id: 'tercera', start_datetime: '2026-10-25T10:00:00Z' },
      { id: 'primera', start_datetime: '2026-10-22T18:00:00Z' },
      { id: 'segunda', start_datetime: '2026-10-23T09:00:00Z' },
    ]
    expect(nextTasks(tasks, 2, now).map(t => t.id)).toEqual(['primera', 'segunda'])
  })

  it('el porcentaje no divide por cero', () => {
    expect(percentOf(3, 12)).toBe(25)
    expect(percentOf(0, 0)).toBe(0)
  })
})
