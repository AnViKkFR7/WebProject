// lib/consent.ts — decisión de cookies y medición. A copiar en el proyecto
// de CADA web de empresa.
//
// Dos capas distintas, y es importante no mezclarlas:
//
//   measurement  Nuestra medición propia. NO usa cookies ni toca el
//                dispositivo, así que no necesita consentimiento previo
//                (LSSI 22.2). Va por interés legítimo (RGPD 6.1.f): activa
//                por defecto, pero con derecho de oposición (art. 21).
//   analytics    Cookies de analítica (Google Analytics). Consentimiento sí.
//   marketing    Cookies de publicidad (Meta, Google Ads). Consentimiento sí.
//
// Rechazar las cookies NO apaga la medición propia: son cosas distintas y el
// banner debe decirlo. La medición solo se apaga si la persona se opone, o
// si su navegador manda la señal Global Privacy Control.

const STORAGE_KEY = 'moira.consent.v1'

/** Súbela si cambian las finalidades: se vuelve a preguntar a todo el mundo. */
export const CONSENT_VERSION = 1

/** Caduca al año: pasado ese plazo se vuelve a preguntar. */
export const CONSENT_MAX_DAYS = 365

export interface Consent {
  analytics: boolean
  marketing: boolean
  measurement: boolean
  decidedAt: string
  version: number
}

/** El navegador pide por ley que no se le venda/compartan datos */
export const globalPrivacyControl = (): boolean =>
  typeof navigator !== 'undefined' && (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true

/**
 * La decisión guardada, o null si no hay, está caducada, es de otra versión
 * o está corrupta. En todos esos casos hay que volver a preguntar.
 */
export function readConsent(): Consent | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Consent>
    if (parsed.version !== CONSENT_VERSION) return null
    if (typeof parsed.decidedAt !== 'string') return null

    const age = (Date.now() - new Date(parsed.decidedAt).getTime()) / 86_400_000
    if (!Number.isFinite(age) || age > CONSENT_MAX_DAYS || age < 0) return null

    return {
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      measurement: parsed.measurement !== false,
      decidedAt: parsed.decidedAt,
      version: CONSENT_VERSION,
    }
  } catch {
    return null
  }
}

export function writeConsent(decision: Pick<Consent, 'analytics' | 'marketing' | 'measurement'>): Consent {
  const consent: Consent = { ...decision, decidedAt: new Date().toISOString(), version: CONSENT_VERSION }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  } catch {
    // Almacenamiento bloqueado: la decisión vale para esta visita
  }
  return consent
}

/**
 * ¿Se puede medir sin cookies? Sí, salvo oposición expresa.
 * Mientras no haya decidido nada, GPC cuenta como oposición.
 */
export const measurementAllowed = (consent: Consent | null): boolean =>
  consent ? consent.measurement !== false : !globalPrivacyControl()

/** ¿Hay que enseñar el banner? */
export const needsDecision = (consent: Consent | null): boolean => consent === null
