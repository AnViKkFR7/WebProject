import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { formatDateTime, formatTime, localInputToISO, toLocalInputValue } from './dates'

// Los tests asumen hora de Madrid, como los usuarios reales del panel
process.env.TZ = 'Europe/Madrid'

describe('dates — bug del desfase horario de Planning', () => {
  it('guarda la hora local con zona: 10:00 en Madrid (verano) son 08:00 UTC', () => {
    // Antes se enviaba '2026-07-15T10:00' sin zona y Postgres lo guardaba como 10:00 UTC
    expect(localInputToISO('2026-07-15T10:00')).toBe('2026-07-15T08:00:00.000Z')
  })

  it('en invierno el desfase es de 1 hora', () => {
    expect(localInputToISO('2026-01-15T10:00')).toBe('2026-01-15T09:00:00.000Z')
  })

  it('lo que viene de la base de datos se vuelve a mostrar en la hora escrita', () => {
    const stored = localInputToISO('2026-07-15T10:00')
    expect(toLocalInputValue(stored)).toBe('2026-07-15T10:00')
    // Formato con offset, como lo devuelve Supabase
    expect(toLocalInputValue('2026-07-15T08:00:00+00:00')).toBe('2026-07-15T10:00')
  })

  it('la etiqueta de hora coincide con la posición en la rejilla (hora local)', () => {
    // Antes la etiqueta cortaba el texto (slice(11,16)) y mostraba "08:00" en UTC
    expect(formatTime('2026-07-15T08:00:00+00:00')).toBe('10:00')
    expect(formatDateTime('2026-07-15T08:00:00+00:00')).toBe('15/07/2026 10:00')
  })

  it('valores vacíos o inválidos no rompen', () => {
    expect(localInputToISO('')).toBeNull()
    expect(localInputToISO('no es fecha')).toBeNull()
    expect(toLocalInputValue(null)).toBe('')
    expect(formatTime(undefined)).toBe('')
  })
})
