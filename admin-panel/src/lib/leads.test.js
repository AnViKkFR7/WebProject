import { describe, expect, it } from 'vitest'
import { ageLabel, countByStatus, filterLeads, isStale, NEXT_STATUS } from './leads'

const t = (key) => ({
  'leads.ageNow': 'ahora',
  'leads.ageMinutes': 'hace {n} min',
  'leads.ageHours': 'hace {n} h',
  'leads.ageDays': 'hace {n} d',
}[key])

const leads = [
  { id: '1', status: 'new', name: 'Ana Pérez', email: 'ana@ejemplo.com', message: 'Quiero un presupuesto' },
  { id: '2', status: 'contacted', name: 'Luis', phone: '600112233', message: 'Reforma de baño' },
  { id: '3', status: 'closed', name: 'Marta', email: 'marta@otra.com', message: null },
  { id: '4', status: 'new', name: 'Pedro', email: null, message: 'presupuesto piscina' },
]

describe('leads — recuentos y filtros', () => {
  it('cuenta por estado con los tres siempre presentes', () => {
    expect(countByStatus(leads)).toEqual({ new: 2, contacted: 1, closed: 1, total: 4 })
    expect(countByStatus([])).toEqual({ new: 0, contacted: 0, closed: 0, total: 0 })
  })

  it('filtra por estado', () => {
    expect(filterLeads(leads, { status: 'new' }).map(l => l.id)).toEqual(['1', '4'])
    expect(filterLeads(leads, { status: 'all' })).toHaveLength(4)
  })

  it('busca en nombre, email, teléfono y mensaje, sin distinguir mayúsculas', () => {
    expect(filterLeads(leads, { query: 'PRESUPUESTO' }).map(l => l.id)).toEqual(['1', '4'])
    expect(filterLeads(leads, { query: '600112233' }).map(l => l.id)).toEqual(['2'])
    expect(filterLeads(leads, { query: 'ana@' }).map(l => l.id)).toEqual(['1'])
  })

  it('un campo vacío no rompe la búsqueda', () => {
    expect(filterLeads(leads, { query: 'nada de nada' })).toEqual([])
  })

  it('combina estado y búsqueda', () => {
    expect(filterLeads(leads, { status: 'new', query: 'piscina' }).map(l => l.id)).toEqual(['4'])
  })
})

describe('leads — seguimiento', () => {
  it('el siguiente estado lleva de nueva a contactada y a cerrada', () => {
    expect(NEXT_STATUS.new).toBe('contacted')
    expect(NEXT_STATUS.contacted).toBe('closed')
    expect(NEXT_STATUS.closed).toBeNull()
  })

  it('dice cuánto hace que entró', () => {
    const now = new Date('2026-10-22T12:00:00Z')
    expect(ageLabel('2026-10-22T11:59:30Z', t, now)).toBe('ahora')
    expect(ageLabel('2026-10-22T11:30:00Z', t, now)).toBe('hace 30 min')
    expect(ageLabel('2026-10-22T09:00:00Z', t, now)).toBe('hace 3 h')
    expect(ageLabel('2026-10-19T12:00:00Z', t, now)).toBe('hace 3 d')
    expect(ageLabel('fecha mala', t, now)).toBe('')
  })

  it('marca como olvidada una solicitud nueva de hace más de 2 días', () => {
    const now = new Date('2026-10-22T12:00:00Z')
    expect(isStale({ status: 'new', created_at: '2026-10-19T12:00:00Z' }, now)).toBe(true)
    expect(isStale({ status: 'new', created_at: '2026-10-22T09:00:00Z' }, now)).toBe(false)
    // Si ya se contactó, no está olvidada por mucho tiempo que pase
    expect(isStale({ status: 'contacted', created_at: '2026-01-01T00:00:00Z' }, now)).toBe(false)
  })
})
