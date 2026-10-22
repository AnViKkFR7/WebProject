// lib/trackCore.ts — núcleo de la medición, sin dependencias.
//
// Lo usan los dos lados: el navegador (lib/analytics.ts) y la función de
// servidor (api/track.ts). Aquí no se toca la red ni la base de datos, solo
// se valida y se limpia, para poder probarlo.
//
// La idea de fondo: el navegador dice QUÉ pasó; el servidor decide QUIÉN
// (hash anónimo), DESDE DÓNDE (país por IP) y CON QUÉ (dispositivo). Así
// nadie puede falsear su identidad ni su procedencia desde el cliente.

export const TRACK_EVENTS = ['page_view', 'cta_click', 'scroll_depth', 'engagement', 'not_found'] as const
export type TrackEvent = (typeof TRACK_EVENTS)[number]

/**
 * Claves de clic que valen en TODAS las empresas sin darlas de alta.
 *
 * Teléfono, email y formulario son la conversión de cualquier web de empresa,
 * y si dependieran de que cada cliente las registre en el panel, el olvido se
 * paga con datos perdidos en silencio (el servidor descarta las claves que no
 * conoce). Por eso se tratan como page_view: implícitas y siempre permitidas.
 *
 * Si cambias esta lista, cambia también RESERVED_EVENT_KEYS en
 * admin-panel/src/lib/analyticsEvents.js (hay un test que lo comprueba).
 */
export const RESERVED_EVENT_KEYS = ['phone_click', 'email_click', 'form_submit'] as const

/** Umbrales de scroll que se miden. Cualquier otro valor se descarta. */
export const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const

/** Tope de segundos por visita: una pestaña olvidada abierta no debe falsear la media */
export const MAX_ENGAGEMENT_SECONDS = 7200

export interface TrackPayload {
  company_id: string
  event_type: TrackEvent
  event_key?: string   // solo en cta_click: reservada o dada de alta en el panel
  value?: number       // scroll_depth: 25|50|75|100 · engagement: segundos
  path?: string
  lang?: string
  referrer?: string    // solo el dominio
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

const LIMITS = {
  path: 300,
  event_key: 80,
  lang: 12,
  referrer: 120,
  utm: 100,
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Volver de una pasarela o de un enlace de acceso no es "una visita desde
// stripe.com": ensuciaría las fuentes de tráfico.
const NOT_A_SOURCE = ['stripe.com', 'stripe.network', 'paypal.com', 'supabase.co', 'checkout.stripe.com']

// El panel de administración no es tráfico de la web pública. Insensible a
// mayúsculas: el router no distingue, así que /ADMIN también es el panel.
const INTERNAL_PATH_RE = /^\/(en\/)?(admin|_ds|_emails|api)(\/|$)/i

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|curl|wget|python|axios|node-fetch|phantom|puppeteer|playwright|preview|monitor|pingdom|uptime/i

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : undefined
}

/** Un user-agent vacío también cuenta como bot: un navegador real siempre manda uno */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === '') return true
  return BOT_RE.test(userAgent)
}

export function deviceFromUa(userAgent: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  const ua = (userAgent ?? '').toLowerCase()
  if (/ipad|tablet/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return 'tablet'
  if (/mobi|iphone|ipod|android/.test(ua)) return 'mobile'
  return 'desktop'
}

/**
 * ¿La petición viene de la propia web? Corta el envenenamiento fácil desde
 * otro sitio o con curl. Sin cabeceras que lo demuestren, se descarta.
 */
export function isSameOrigin(get: (header: string) => string | null): boolean {
  const site = get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = get('origin')
  const host = get('x-forwarded-host') ?? get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Quita de la ruta todo lo que pueda identificar a una persona: ids, tokens
 * y números largos. Una URL como /items/8f3e...-uuid enlazaría la visita con
 * un registro concreto.
 */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0]!.replace(/\/{2,}/g, '/')
  const parts = clean.split('/').map((segment) => {
    if (UUID_RE.test(segment)) return ':id'
    if (/\d{5,}/.test(segment) || /^[A-Za-z0-9_-]{24,}$/.test(segment)) return ':token'
    return segment
  })
  const out = parts.join('/')
  return out.length > 1 ? out.replace(/\/$/, '') : '/'
}

export const isInternalPath = (path: string): boolean => INTERNAL_PATH_RE.test(path)

export const isReservedEventKey = (key: string): boolean =>
  (RESERVED_EVENT_KEYS as readonly string[]).includes(key)

/** ¿Se acepta este clic? Las reservadas siempre; el resto, solo si la empresa las dio de alta. */
export const isEventKeyAllowed = (key: string, activeKeys: Set<string>): boolean =>
  isReservedEventKey(key) || activeKeys.has(key)

/** Solo el dominio, sin www. Vacío si es la propia web o una pasarela. */
export function referrerHost(referrer: string | undefined, ownHost: string | undefined): string | undefined {
  if (!referrer) return undefined
  let host: string
  try {
    host = new URL(referrer).host.toLowerCase().replace(/^www\./, '')
  } catch {
    // Puede venir ya como dominio pelado desde el navegador
    host = referrer.toLowerCase().replace(/^www\./, '')
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return undefined
  }
  const own = (ownHost ?? '').toLowerCase().replace(/^www\./, '')
  if (host === own) return undefined
  if (NOT_A_SOURCE.some((domain) => host === domain || host.endsWith(`.${domain}`))) return undefined
  return host.slice(0, LIMITS.referrer)
}

/** Geolocalización por IP que añade el hosting. Nunca la manda el navegador. */
export function geoFromHeaders(get: (header: string) => string | null) {
  const country = get('x-vercel-ip-country') ?? get('cf-ipcountry') ?? null
  const region = get('x-vercel-ip-country-region') ?? null
  const rawCity = get('x-vercel-ip-city') ?? get('cf-ipcity') ?? null
  let city: string | null = null
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity)
    } catch {
      city = rawCity
    }
  }
  return {
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    region: region ? region.slice(0, 80) : null,
    city: city ? city.slice(0, 80) : null,
  }
}

/**
 * Visitante anónimo del día.
 *
 * No se guarda la IP: se guarda un hash de (sal del día + IP + navegador).
 * Sirve para contar únicos DENTRO de un día; como la sal cambia cada día y
 * se destruye a las 48 h, pasado ese plazo ni con la IP se puede recalcular
 * de quién era. Sustituye al session_id que generaba el navegador, que era
 * falseable y contaba una visita nueva por pestaña.
 */
export async function visitorHash(secret: string, day: string, ip: string, userAgent: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const salt = hex(await crypto.subtle.sign('HMAC', key, enc.encode(day)))
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}|${ip}|${userAgent}`))
  return hex(digest).slice(0, 24)
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** El día según la zona del negocio, no UTC: la sal cambia a medianoche de aquí. */
export function businessDay(now: Date, timeZone = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone }).format(now)
}

/**
 * Valida y limpia lo que manda el navegador. Devuelve null para descartar.
 * `activeEventKeys` son las claves que la empresa tiene dadas de alta.
 */
export function parseTrackPayload(
  input: unknown,
  options: { ownHost?: string; activeEventKeys?: Set<string> } = {},
): TrackPayload | null {
  if (!input || typeof input !== 'object') return null
  const body = input as Record<string, unknown>

  const company_id = text(body.company_id, 64)
  if (!company_id || !UUID_RE.test(company_id)) return null

  const event_type = body.event_type
  if (typeof event_type !== 'string' || !TRACK_EVENTS.includes(event_type as TrackEvent)) return null

  const rawPath = text(body.path, LIMITS.path) ?? '/'
  if (!rawPath.startsWith('/')) return null
  const path = normalizePath(rawPath)
  if (isInternalPath(path)) return null

  let event_key: string | undefined
  if (event_type === 'cta_click') {
    event_key = text(body.event_key, LIMITS.event_key)
    if (!event_key || !/^[\w.:-]+$/.test(event_key)) return null
    // Una clave que la empresa no ha dado de alta se descarta en silencio
    // (salvo las reservadas, que valen siempre)
    if (options.activeEventKeys && !isEventKeyAllowed(event_key, options.activeEventKeys)) return null
  }

  let value: number | undefined
  if (event_type === 'scroll_depth') {
    // Solo los umbrales conocidos: nada de valores inventados
    const depth = Number(body.value)
    if (!(SCROLL_THRESHOLDS as readonly number[]).includes(depth)) return null
    value = depth
  }
  if (event_type === 'engagement') {
    const seconds = Math.round(Number(body.value))
    if (!Number.isFinite(seconds) || seconds < 1) return null
    value = Math.min(seconds, MAX_ENGAGEMENT_SECONDS)
  }

  const lang = text(body.lang, LIMITS.lang)?.toLowerCase()

  return {
    company_id,
    event_type: event_type as TrackEvent,
    event_key,
    value,
    path,
    lang: lang && /^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(lang) ? lang : undefined,
    referrer: referrerHost(text(body.referrer, LIMITS.referrer), options.ownHost),
    utm_source: text(body.utm_source, LIMITS.utm)?.toLowerCase(),
    utm_medium: text(body.utm_medium, LIMITS.utm)?.toLowerCase(),
    utm_campaign: text(body.utm_campaign, LIMITS.utm)?.toLowerCase(),
  }
}
