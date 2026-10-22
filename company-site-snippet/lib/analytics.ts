// lib/analytics.ts — a copiar en el proyecto de CADA web de empresa.
// Código idéntico para todas salvo la variable de entorno VITE_COMPANY_ID.
//
// Qué manda el navegador: tipo de evento, ruta, idioma y, en la PRIMERA
// vista de la visita, de dónde viene (referrer y UTM). Nada más: quién,
// desde dónde y con qué lo decide el servidor (ver api/track.ts).
//
// No usa cookies ni localStorage para medir: no hay identificador que
// guardar. Por eso no necesita consentimiento previo, solo respetar la
// oposición (ver lib/consent.ts).
//
// QUÉ SE MIDE SOLO, sin tocar el HTML de la web (initAutoTracking):
//   - Vistas de página                         (trackPageview, en cada ruta)
//   - Clics en enlaces tel: y mailto:          -> phone_click / email_click
//   - Clics marcados con data-track-event      -> la clave que pongas
//   - Hasta dónde se baja la página            -> 25 / 50 / 75 / 100 %
//   - Tiempo real en la página (pestaña visible)
//   - Envío del formulario de contacto         -> form_submit (ver lib/leads.ts)
// Y lo que hay que llamar a mano: trackNotFound() desde la página 404.
//
// Variable de entorno requerida (esta sí con prefijo VITE_, es pública):
//   VITE_COMPANY_ID   (uuid de esta empresa en la tabla companies)
import { measurementAllowed, readConsent } from './consent'

const ENDPOINT = '/api/track'
const COMPANY_ID = import.meta.env.VITE_COMPANY_ID

// En desarrollo no se mide, para no ensuciar los datos del cliente
const ENABLED_ENV = import.meta.env.PROD

const SCROLL_THRESHOLDS = [25, 50, 75, 100]

// Una página que apenas se puede desplazar no mide scroll: "llegó al 100 %"
// sin moverse no dice nada y falsearía el dato.
const MIN_SCROLLABLE_PX = 200

let enabled = true
let pageviewCount = 0

// Estado de la página en la que está la persona ahora mismo
let pagePath = typeof window !== 'undefined' ? window.location.pathname : '/'
let reachedDepths = new Set<number>()
let activeMs = 0
let visibleSince: number | null = null
let scrollQueued = false

/** Lo llama el banner de cookies al decidir, y también al arrancar */
export function setMeasurement(on: boolean) {
  enabled = on
}

/** Arranque: respeta lo que ya decidió esta persona (o GPC) */
export function initAnalytics() {
  setMeasurement(measurementAllowed(readConsent()))
}

type EventType = 'page_view' | 'cta_click' | 'scroll_depth' | 'engagement' | 'not_found'

interface Payload {
  event_type: EventType
  event_key?: string
  value?: number
  path?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

/** De dónde viene la visita. Solo se manda una vez, en la primera vista. */
function acquisition(): Partial<Payload> {
  if (pageviewCount > 0) return {}
  const params = new URLSearchParams(window.location.search)
  return {
    referrer: document.referrer || undefined,
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
  }
}

function send(payload: Payload) {
  if (!ENABLED_ENV || !enabled || typeof window === 'undefined') return
  if (!COMPANY_ID) {
    console.warn('[analytics] VITE_COMPANY_ID no está configurado — evento descartado')
    return
  }
  const body = JSON.stringify({
    company_id: COMPANY_ID,
    lang: navigator.language,
    ...payload,
    // Después de ...payload y con ??: un path undefined NO debe pisar la ruta
    // actual (antes, trackPageview() sin argumento se guardaba como "/")
    path: payload.path ?? window.location.pathname,
  })
  try {
    // sendBeacon no bloquea la navegación ni se pierde al cambiar de página
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return
    void fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // La medición nunca rompe la web
  }
}

// ── Tiempo en página ────────────────────────────────────────────────
// Solo cuenta el tiempo con la pestaña visible: dejarla abierta de fondo no
// es leer. Se manda UNA vez por página vista, al irse o al ocultarse.

const pauseClock = () => {
  if (visibleSince !== null) {
    activeMs += performance.now() - visibleSince
    visibleSince = null
  }
}

const resumeClock = () => {
  if (visibleSince === null) visibleSince = performance.now()
}

function flushEngagement() {
  pauseClock()
  const seconds = Math.round(activeMs / 1000)
  activeMs = 0
  // Menos de 1 s es ruido (por ejemplo, el primer pageview del router)
  if (seconds >= 1) send({ event_type: 'engagement', value: seconds, path: pagePath })
}

// ── Scroll ──────────────────────────────────────────────────────────

function checkScroll() {
  scrollQueued = false
  const doc = document.documentElement
  if (doc.scrollHeight - window.innerHeight < MIN_SCROLLABLE_PX) return

  const depth = Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100)
  for (const threshold of SCROLL_THRESHOLDS) {
    if (depth >= threshold && !reachedDepths.has(threshold)) {
      reachedDepths.add(threshold)
      send({ event_type: 'scroll_depth', value: threshold, path: pagePath })
    }
  }
}

function onScroll() {
  if (scrollQueued) return
  scrollQueued = true
  requestAnimationFrame(checkScroll)
}

// ── API pública ─────────────────────────────────────────────────────

/**
 * En cada cambio de ruta. Cierra la medición de la página que se deja
 * (tiempo) y empieza la de la nueva. La primera vez añade de dónde viene.
 */
export function trackPageview(path?: string) {
  const next = path ?? window.location.pathname

  // La primera llamada es la página con la que se entró: no hay "anterior"
  // que cerrar, y cortar el reloj ahora haría perder el primer segundo.
  if (pageviewCount > 0) {
    flushEngagement()
    reachedDepths = new Set()
    activeMs = 0
    visibleSince = document.visibilityState === 'visible' ? performance.now() : null
  }

  pagePath = next
  send({ event_type: 'page_view', path: next, ...acquisition() })
  pageviewCount += 1
}

/** Clic en un CTA. Vale una clave reservada o una dada de alta en el panel. */
export const trackEvent = (eventKey: string) => send({ event_type: 'cta_click', event_key: eventKey })

/**
 * Llámala desde la página 404 de la web. Guarda qué URL falló y, si la
 * persona llegó directamente a ella, desde qué sitio (es el dato que
 * permite arreglar un enlace roto en otra web).
 */
export function trackNotFound() {
  send({
    event_type: 'not_found',
    path: window.location.pathname,
    // document.referrer solo vale en la carga inicial; tras navegar dentro
    // de la SPA seguiría apuntando a la entrada original y atribuiría mal.
    referrer: pageviewCount <= 1 ? document.referrer || undefined : undefined,
  })
}

/** Qué clave corresponde a un clic, o null. data-track-event gana a tel:/mailto:. */
export function keyForClick(target: Element | null): string | null {
  const custom = target?.closest('[data-track-event]')?.getAttribute('data-track-event')
  if (custom) return custom

  const href = target?.closest('a[href]')?.getAttribute('href')?.trim().toLowerCase() ?? ''
  if (href.startsWith('tel:')) return 'phone_click'
  if (href.startsWith('mailto:')) return 'email_click'
  return null
}

let started = false

/**
 * Arranca la medición automática. Llamar una sola vez en el punto de entrada.
 * Es seguro llamarla de nuevo (por ejemplo con hot reload): no duplica nada.
 */
export function initAutoTracking() {
  if (typeof document === 'undefined' || started) return
  started = true
  initAnalytics()

  // Clics: tel:, mailto: y data-track-event, sin JS por botón
  document.addEventListener('click', (event) => {
    const key = keyForClick(event.target as Element | null)
    if (key) trackEvent(key)
  })

  // Scroll
  window.addEventListener('scroll', onScroll, { passive: true })

  // Tiempo en página
  if (document.visibilityState === 'visible') resumeClock()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushEngagement()
    } else {
      // Al volver, un tramo nuevo de la misma página. Una persona que se va
      // y vuelve aporta dos tramos: es una aproximación, y se documenta.
      resumeClock()
    }
  })
  window.addEventListener('pagehide', flushEngagement)

  // El formulario de contacto avisa solo cuando la solicitud LLEGA (ver
  // lib/leads.ts), así analítica y bandeja cuadran. Va por evento del DOM
  // para que leads.ts no dependa de este fichero.
  window.addEventListener('moira:lead-sent', () => trackEvent('form_submit'))
}
