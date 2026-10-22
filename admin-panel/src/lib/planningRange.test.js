import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { toDateOnly, visibleRange } from './planningRange'

process.env.TZ = 'Europe/Madrid'

// Sin margen es más fácil comprobar los límites exactos
const range = (view, date) => {
  const { from, to } = visibleRange(view, date, 0)
  return [from.slice(0, 10), to.slice(0, 10)]
}

describe('planningRange — solo se pide el tramo visible', () => {
  it('vista de día: ese día', () => {
    expect(range('day', new Date(2026, 9, 21))).toEqual(['2026-10-20', '2026-10-21'])
  })

  it('vista de semana: de lunes a domingo', () => {
    // miércoles 21/10/2026 → semana del 19 al 25
    const [from, to] = range('week', new Date(2026, 9, 21))
    expect(from).toBe('2026-10-18') // 19 a las 00:00 locales = 18 a las 22:00 UTC
    expect(to).toBe('2026-10-25')
  })

  it('vista de mes: incluye los días de relleno de la primera y última semana', () => {
    const [from, to] = range('month', new Date(2026, 9, 15))
    expect(from).toBe('2026-09-27') // lunes 28/09 en local
    expect(to).toBe('2026-11-01')
  })

  it('el margen amplía el rango por los dos lados', () => {
    const sin = visibleRange('week', new Date(2026, 9, 21), 0)
    const con = visibleRange('week', new Date(2026, 9, 21), 7)
    expect(new Date(con.from) < new Date(sin.from)).toBe(true)
    expect(new Date(con.to) > new Date(sin.to)).toBe(true)
  })

  it('billing_date es una columna de fecha, sin hora', () => {
    expect(toDateOnly('2026-10-21T22:00:00.000Z')).toBe('2026-10-21')
  })
})
