// Prueba el comportamiento real de analytics.ts con un navegador simulado:
// scroll, reloj de tiempo en página, cambios de ruta y consentimiento.
//
// En desarrollo la medición está apagada por diseño (import.meta.env.PROD), así
// que aquí se enciende a propósito y se recogen los envíos de sendBeacon.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Sent = Record<string, unknown>

interface Browser {
  sent: Sent[]
  listeners: Record<string, ((event?: unknown) => void)[]>
  setScroll: (y: number) => void
  advance: (ms: number) => void
  setVisibility: (state: 'visible' | 'hidden') => void
  fire: (type: string, event?: unknown) => void
  flush: () => Promise<Sent[]>
}

const COMPANY = '0aad4a59-d6ee-47c9-bb9e-da5e2bb3fb48'

function installBrowser(options: { scrollHeight?: number; search?: string; referrer?: string } = {}): Browser {
  const listeners: Browser['listeners'] = {}
  const blobs: Blob[] = []
  let now = 1000
  let scrollY = 0

  const state = { visibility: 'visible' as 'visible' | 'hidden' }
  const add = (type: string, handler: (event?: unknown) => void) => {
    ;(listeners[type] ??= []).push(handler)
  }
  const doc = {
    get visibilityState() { return state.visibility },
    referrer: options.referrer ?? '',
    documentElement: { scrollHeight: options.scrollHeight ?? 3000 },
    addEventListener: add,
  }
  const win = {
    location: { pathname: '/inicio', search: options.search ?? '' },
    get innerHeight() { return 800 },
    get scrollY() { return scrollY },
    addEventListener: add,
    dispatchEvent: (event: { type: string }) => (listeners[event.type] ?? []).forEach((fn) => fn(event)),
  }

  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('navigator', {
    language: 'es-ES',
    sendBeacon: (_url: string, blob: Blob) => { blobs.push(blob); return true },
  })
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb())
  vi.stubGlobal('CustomEvent', class { type: string; constructor(type: string) { this.type = type } })

  const fire = (type: string, event?: unknown) => (listeners[type] ?? []).forEach((fn) => fn(event))

  return {
    sent: [],
    listeners,
    setScroll: (y) => { scrollY = y; fire('scroll') },
    advance: (ms) => { now += ms },
    setVisibility: (v) => { state.visibility = v; fire('visibilitychange') },
    fire,
    flush: async () => Promise.all(blobs.map(async (b) => JSON.parse(await b.text()))),
  }
}

/** Carga un analytics.ts limpio, en "producción" y con empresa configurada */
async function load(options: Parameters<typeof installBrowser>[0] = {}) {
  vi.resetModules()
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_COMPANY_ID', COMPANY)
  const browser = installBrowser(options)
  const mod = await import('./analytics')
  return { browser, mod }
}

const types = (events: Sent[]) => events.map((e) => e.event_type)

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('analytics en el navegador — vistas de página', () => {
  it('la primera vista manda de dónde viene y las UTM; las siguientes no', async () => {
    const { browser, mod } = await load({ search: '?utm_source=Instagram&utm_campaign=verano', referrer: 'https://www.google.com/' })
    mod.initAutoTracking()
    mod.trackPageview('/inicio')
    mod.trackPageview('/servicios')

    const [first, second] = await browser.flush()
    expect(first).toMatchObject({ event_type: 'page_view', path: '/inicio', utm_source: 'Instagram', referrer: 'https://www.google.com/' })
    expect(second).toMatchObject({ event_type: 'page_view', path: '/servicios' })
    expect(second.referrer).toBeUndefined()
    expect(second.utm_source).toBeUndefined()
  })

  it('trackPageview() sin argumento usa la ruta actual (antes se guardaba como "/")', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    mod.trackPageview()
    const [event] = await browser.flush()
    expect(event.path).toBe('/inicio')
  })
})

describe('analytics en el navegador — scroll', () => {
  it('manda cada umbral una sola vez, según se va bajando', async () => {
    const { browser, mod } = await load({ scrollHeight: 3000 })
    mod.initAutoTracking()
    mod.trackPageview('/inicio')

    browser.setScroll(0)       // (0+800)/3000 = 27 %  -> 25
    browser.setScroll(100)     // sigue en 25: no repite
    browser.setScroll(1200)    // 67 %  -> 50
    browser.setScroll(2200)    // 100 % -> 75 y 100
    browser.setScroll(2200)    // nada nuevo

    const depths = (await browser.flush()).filter((e) => e.event_type === 'scroll_depth').map((e) => e.value)
    expect(depths).toEqual([25, 50, 75, 100])
  })

  it('una página que apenas se desplaza no mide scroll', async () => {
    const { browser, mod } = await load({ scrollHeight: 900 })
    mod.initAutoTracking()
    mod.trackPageview('/inicio')
    browser.setScroll(100)
    expect(types(await browser.flush())).toEqual(['page_view'])
  })

  it('al cambiar de página se vuelve a medir desde cero', async () => {
    const { browser, mod } = await load({ scrollHeight: 3000 })
    mod.initAutoTracking()
    mod.trackPageview('/a')
    browser.setScroll(2200)
    mod.trackPageview('/b')
    browser.setScroll(2200)

    const scrolls = (await browser.flush()).filter((e) => e.event_type === 'scroll_depth')
    expect(scrolls.filter((e) => e.path === '/a').map((e) => e.value)).toEqual([25, 50, 75, 100])
    expect(scrolls.filter((e) => e.path === '/b').map((e) => e.value)).toEqual([25, 50, 75, 100])
  })
})

describe('analytics en el navegador — tiempo en página', () => {
  it('al cambiar de ruta manda el tiempo de la página que se deja, con SU ruta', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    mod.trackPageview('/a')
    browser.advance(12_000)
    mod.trackPageview('/b')

    const engagement = (await browser.flush()).filter((e) => e.event_type === 'engagement')
    expect(engagement).toEqual([expect.objectContaining({ path: '/a', value: 12 })])
  })

  it('la primera vista no corta el reloj: el primer segundo no se pierde', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    browser.advance(3000)     // la persona ya lleva 3 s cuando el router avisa
    mod.trackPageview('/a')
    browser.advance(4000)
    mod.trackPageview('/b')

    const [engagement] = (await browser.flush()).filter((e) => e.event_type === 'engagement')
    expect(engagement.value).toBe(7)
  })

  it('con la pestaña oculta el reloj no corre', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    mod.trackPageview('/a')
    browser.advance(5000)
    browser.setVisibility('hidden')     // manda 5 s
    browser.advance(600_000)            // diez minutos de fondo: no cuentan
    browser.setVisibility('visible')
    browser.advance(3000)
    browser.fire('pagehide')            // manda los 3 s del segundo tramo

    const values = (await browser.flush()).filter((e) => e.event_type === 'engagement').map((e) => e.value)
    expect(values).toEqual([5, 3])
  })

  it('ocultar la pestaña y luego salir no manda el mismo tiempo dos veces', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    mod.trackPageview('/a')
    browser.advance(8000)
    browser.setVisibility('hidden')
    browser.fire('pagehide')

    const values = (await browser.flush()).filter((e) => e.event_type === 'engagement').map((e) => e.value)
    expect(values).toEqual([8])
  })

  it('menos de un segundo no se manda: es ruido', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    mod.trackPageview('/a')
    browser.advance(400)
    mod.trackPageview('/b')
    expect(types(await browser.flush())).not.toContain('engagement')
  })
})

describe('analytics en el navegador — clics, formulario y 404', () => {
  it('un clic en un enlace tel: manda phone_click', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    const link = {
      closest: (s: string) => (s === 'a[href]' ? { getAttribute: () => 'tel:600112233' } : null),
    }
    browser.fire('click', { target: link })

    const [event] = await browser.flush()
    // La ruta importa: sin ella el servidor guarda el clic como "/" y no se
    // sabría en qué página llaman. Los clics no mandan path, lo rellena send().
    expect(event).toMatchObject({ event_type: 'cta_click', event_key: 'phone_click', path: '/inicio' })
  })

  it('un clic normal no manda nada', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    browser.fire('click', { target: { closest: () => null } })
    expect(await browser.flush()).toEqual([])
  })

  it('una solicitud enviada con éxito manda form_submit', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    browser.fire('moira:lead-sent')
    const [event] = await browser.flush()
    expect(event).toMatchObject({ event_type: 'cta_click', event_key: 'form_submit', path: '/inicio' })
  })

  it('trackNotFound guarda la ruta que falló y de dónde se llegó, solo en la entrada', async () => {
    const { browser, mod } = await load({ referrer: 'https://blog-amigo.com/post' })
    mod.initAutoTracking()
    mod.trackPageview('/viejo')
    mod.trackNotFound()

    const notFound = (await browser.flush()).find((e) => e.event_type === 'not_found')
    expect(notFound).toMatchObject({ path: '/inicio', referrer: 'https://blog-amigo.com/post' })
  })

  it('tras navegar dentro de la web, el referrer del 404 ya no se atribuye a la entrada', async () => {
    const { browser, mod } = await load({ referrer: 'https://blog-amigo.com/post' })
    mod.initAutoTracking()
    mod.trackPageview('/a')
    mod.trackPageview('/b')
    mod.trackNotFound()

    const notFound = (await browser.flush()).find((e) => e.event_type === 'not_found')
    expect(notFound?.referrer).toBeUndefined()
  })
})

describe('analytics en el navegador — consentimiento y entorno', () => {
  it('si la persona se opone, no se manda nada de nada', async () => {
    const { browser, mod } = await load({ scrollHeight: 3000 })
    mod.initAutoTracking()
    mod.setMeasurement(false)
    mod.trackPageview('/a')
    browser.setScroll(2200)
    browser.advance(9000)
    browser.fire('pagehide')
    browser.fire('moira:lead-sent')
    expect(await browser.flush()).toEqual([])
  })

  it('en desarrollo no se mide, aunque haya empresa configurada', async () => {
    vi.resetModules()
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_COMPANY_ID', COMPANY)
    const browser = installBrowser()
    const mod = await import('./analytics')
    mod.initAutoTracking()
    mod.trackPageview('/a')
    expect(await browser.flush()).toEqual([])
  })

  it('arrancar dos veces no duplica los avisos (hot reload)', async () => {
    const { browser, mod } = await load()
    mod.initAutoTracking()
    mod.initAutoTracking()
    browser.fire('moira:lead-sent')
    expect(await browser.flush()).toHaveLength(1)
  })
})
