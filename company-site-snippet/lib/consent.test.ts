import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_MAX_DAYS, CONSENT_VERSION, measurementAllowed, needsDecision, readConsent, writeConsent,
} from './consent'

const KEY = 'moira.consent.v1'

// localStorage y navigator de mentira, que en Node no existen
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal('navigator', {})
})

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

describe('consent — qué se guarda y cuándo caduca', () => {
  it('guarda y lee la decisión', () => {
    writeConsent({ analytics: true, marketing: false, measurement: true })
    expect(readConsent()).toMatchObject({ analytics: true, marketing: false, measurement: true })
  })

  it('sin decisión previa hay que preguntar', () => {
    expect(readConsent()).toBeNull()
    expect(needsDecision(null)).toBe(true)
  })

  it('caduca al año', () => {
    localStorage.setItem(KEY, JSON.stringify({
      analytics: true, marketing: true, measurement: true,
      decidedAt: daysAgo(CONSENT_MAX_DAYS + 1), version: CONSENT_VERSION,
    }))
    expect(readConsent()).toBeNull()
  })

  it('una versión antigua obliga a preguntar otra vez', () => {
    localStorage.setItem(KEY, JSON.stringify({
      analytics: true, marketing: true, measurement: true,
      decidedAt: daysAgo(1), version: CONSENT_VERSION - 1,
    }))
    expect(readConsent()).toBeNull()
  })

  it('una decisión corrupta se trata como si no hubiera', () => {
    localStorage.setItem(KEY, 'esto no es json')
    expect(readConsent()).toBeNull()
  })
})

describe('consent — la medición sin cookies es distinta de las cookies', () => {
  it('rechazar las cookies no apaga la medición', () => {
    const consent = writeConsent({ analytics: false, marketing: false, measurement: true })
    expect(measurementAllowed(consent)).toBe(true)
  })

  it('oponerse sí la apaga', () => {
    const consent = writeConsent({ analytics: true, marketing: true, measurement: false })
    expect(measurementAllowed(consent)).toBe(false)
  })

  it('sin decidir nada está activa', () => {
    expect(measurementAllowed(null)).toBe(true)
  })

  it('pero el navegador con Global Privacy Control cuenta como oposición', () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    expect(measurementAllowed(null)).toBe(false)
  })

  it('si ya decidió expresamente que sí, GPC no la anula', () => {
    const consent = writeConsent({ analytics: false, marketing: false, measurement: true })
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    expect(measurementAllowed(consent)).toBe(true)
  })
})
