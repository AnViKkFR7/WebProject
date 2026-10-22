import { describe, expect, it } from 'vitest'
import {
  businessDay, deviceFromUa, geoFromHeaders, isBot, isEventKeyAllowed, isInternalPath, isReservedEventKey,
  isSameOrigin, MAX_ENGAGEMENT_SECONDS, normalizePath, parseTrackPayload, referrerHost, RESERVED_EVENT_KEYS,
  visitorHash,
} from './trackCore'

const COMPANY = '0aad4a59-d6ee-47c9-bb9e-da5e2bb3fb48'
const headers = (map: Record<string, string>) => (name: string) => map[name] ?? null

describe('trackCore — la ruta no puede identificar a nadie', () => {
  it('quita la query y el hash', () => {
    expect(normalizePath('/servicios?utm_source=x#abajo')).toBe('/servicios')
  })

  it('sustituye uuid, tokens y números largos', () => {
    expect(normalizePath('/items/0aad4a59-d6ee-47c9-bb9e-da5e2bb3fb48')).toBe('/items/:id')
    expect(normalizePath('/reserva/123456')).toBe('/reserva/:token')
    expect(normalizePath('/acceso/aB3dE5fG7hI9jK1lM3nO5pQ7')).toBe('/acceso/:token')
  })

  it('normaliza barras y la raíz', () => {
    expect(normalizePath('//servicios//')).toBe('/servicios')
    expect(normalizePath('/')).toBe('/')
  })

  it('el panel no cuenta como tráfico, escriba como escriba la ruta', () => {
    expect(isInternalPath('/admin')).toBe(true)
    expect(isInternalPath('/ADMIN/items')).toBe(true)
    expect(isInternalPath('/en/Admin')).toBe(true)
    expect(isInternalPath('/administracion')).toBe(false) // no es el panel
  })
})

describe('trackCore — fuente de tráfico', () => {
  it('deja solo el dominio, sin www', () => {
    expect(referrerHost('https://www.google.com/search?q=x', 'mi-web.com')).toBe('google.com')
  })

  it('la propia web no es una fuente', () => {
    expect(referrerHost('https://mi-web.com/inicio', 'mi-web.com')).toBeUndefined()
    expect(referrerHost('https://www.mi-web.com/inicio', 'mi-web.com')).toBeUndefined()
  })

  it('volver de una pasarela tampoco', () => {
    expect(referrerHost('https://checkout.stripe.com/pay/x', 'mi-web.com')).toBeUndefined()
    expect(referrerHost('https://www.paypal.com/x', 'mi-web.com')).toBeUndefined()
  })

  it('aguanta basura', () => {
    expect(referrerHost('no es una url', 'mi-web.com')).toBeUndefined()
    expect(referrerHost(undefined, 'mi-web.com')).toBeUndefined()
  })
})

describe('trackCore — bots y dispositivo', () => {
  it('descarta bots y user-agent vacío', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isBot('curl/8.4.0')).toBe(true)
    expect(isBot('HeadlessChrome/120')).toBe(true)
    expect(isBot('')).toBe(true)
    expect(isBot(null)).toBe(true)
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1')).toBe(false)
  })

  it('distingue móvil, tableta y escritorio', () => {
    expect(deviceFromUa('Mozilla/5.0 (iPhone) Mobile Safari')).toBe('mobile')
    expect(deviceFromUa('Mozilla/5.0 (iPad) Safari')).toBe('tablet')
    expect(deviceFromUa('Mozilla/5.0 (Linux; Android 13) Safari')).toBe('tablet') // Android sin "mobile"
    expect(deviceFromUa('Mozilla/5.0 (Windows NT 10.0) Chrome')).toBe('desktop')
  })
})

describe('trackCore — solo desde la propia web', () => {
  it('acepta same-origin', () => {
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
  })

  it('rechaza otra web', () => {
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
  })

  it('sin Sec-Fetch-Site compara Origin con el host', () => {
    expect(isSameOrigin(headers({ origin: 'https://mi-web.com', host: 'mi-web.com' }))).toBe(true)
    expect(isSameOrigin(headers({ origin: 'https://otra.com', host: 'mi-web.com' }))).toBe(false)
  })

  it('una petición sin cabeceras (curl, script) se descarta', () => {
    expect(isSameOrigin(headers({}))).toBe(false)
  })
})

describe('trackCore — geolocalización del hosting', () => {
  it('lee Vercel y Cloudflare, y descodifica la ciudad', () => {
    expect(geoFromHeaders(headers({
      'x-vercel-ip-country': 'ES',
      'x-vercel-ip-country-region': 'CT',
      'x-vercel-ip-city': 'Sant%20Cugat',
    }))).toEqual({ country: 'ES', region: 'CT', city: 'Sant Cugat' })

    expect(geoFromHeaders(headers({ 'cf-ipcountry': 'FR' })).country).toBe('FR')
  })

  it('un país con formato raro se descarta', () => {
    expect(geoFromHeaders(headers({ 'x-vercel-ip-country': 'ESPAÑA' })).country).toBeNull()
  })
})

describe('trackCore — visitante anónimo', () => {
  const ip = '88.1.2.3'
  const ua = 'Mozilla/5.0 (iPhone) Mobile Safari'

  it('el mismo día y la misma persona dan el mismo hash', async () => {
    const a = await visitorHash('secreto', '2026-10-22', ip, ua)
    const b = await visitorHash('secreto', '2026-10-22', ip, ua)
    expect(a).toBe(b)
  })

  it('otro día da otro hash: no se puede seguir a nadie entre días', async () => {
    const hoy = await visitorHash('secreto', '2026-10-22', ip, ua)
    const manana = await visitorHash('secreto', '2026-10-23', ip, ua)
    expect(hoy).not.toBe(manana)
  })

  it('el hash no contiene la IP ni el navegador', async () => {
    const hash = await visitorHash('secreto', '2026-10-22', ip, ua)
    expect(hash).not.toContain(ip)
    expect(hash).not.toContain('iPhone')
    expect(hash).toMatch(/^[0-9a-f]{24}$/)
  })

  it('el día es el de la zona del negocio, no UTC', () => {
    // 22/10 a las 23:30 UTC ya es el 23 en Madrid (UTC+2 en verano)
    expect(businessDay(new Date('2026-07-22T23:30:00Z'), 'Europe/Madrid')).toBe('2026-07-23')
    expect(businessDay(new Date('2026-07-22T12:00:00Z'), 'Europe/Madrid')).toBe('2026-07-22')
  })
})

describe('trackCore — validación de lo que manda el navegador', () => {
  const base = { company_id: COMPANY, event_type: 'page_view', path: '/servicios' }

  it('acepta una visita normal y limpia la ruta', () => {
    const result = parseTrackPayload({ ...base, path: '/servicios?x=1', lang: 'ES-es' })
    expect(result).toMatchObject({ company_id: COMPANY, event_type: 'page_view', path: '/servicios', lang: 'es-es' })
  })

  it('rechaza lo que no es un evento conocido', () => {
    expect(parseTrackPayload({ ...base, event_type: 'purchase' })).toBeNull()
  })

  it('rechaza un company_id que no sea uuid', () => {
    expect(parseTrackPayload({ ...base, company_id: 'regiamare' })).toBeNull()
  })

  it('descarta el tráfico del panel', () => {
    expect(parseTrackPayload({ ...base, path: '/ADMIN/items' })).toBeNull()
  })

  it('un clic necesita una clave dada de alta', () => {
    const click = { ...base, event_type: 'cta_click', event_key: 'whatsapp_click' }
    const keys = new Set(['whatsapp_click'])
    expect(parseTrackPayload(click, { activeEventKeys: keys })).toMatchObject({ event_key: 'whatsapp_click' })
    expect(parseTrackPayload(click, { activeEventKeys: new Set() })).toBeNull()
    expect(parseTrackPayload({ ...click, event_key: 'no válida!' }, { activeEventKeys: keys })).toBeNull()
    expect(parseTrackPayload({ ...base, event_type: 'cta_click' }, { activeEventKeys: keys })).toBeNull()
  })

  it('guarda las UTM en minúsculas y el referrer como dominio', () => {
    const result = parseTrackPayload({
      ...base,
      utm_source: 'Google',
      utm_campaign: 'Verano2026',
      referrer: 'https://www.instagram.com/p/x',
    }, { ownHost: 'mi-web.com' })
    expect(result).toMatchObject({ utm_source: 'google', utm_campaign: 'verano2026', referrer: 'instagram.com' })
  })

  it('un cuerpo vacío o raro no rompe', () => {
    expect(parseTrackPayload(null)).toBeNull()
    expect(parseTrackPayload('hola')).toBeNull()
    expect(parseTrackPayload({})).toBeNull()
  })
})

describe('trackCore — teléfono, email y formulario valen sin dar de alta', () => {
  const base = { company_id: COMPANY, event_type: 'cta_click', path: '/contacto' }
  const noneRegistered = new Set<string>()

  it('las claves reservadas se aceptan aunque la empresa no registre nada', () => {
    for (const key of RESERVED_EVENT_KEYS) {
      expect(parseTrackPayload({ ...base, event_key: key }, { activeEventKeys: noneRegistered }))
        .toMatchObject({ event_key: key })
    }
  })

  it('una clave propia sigue necesitando estar dada de alta', () => {
    expect(parseTrackPayload({ ...base, event_key: 'whatsapp_click' }, { activeEventKeys: noneRegistered })).toBeNull()
    expect(parseTrackPayload({ ...base, event_key: 'whatsapp_click' }, { activeEventKeys: new Set(['whatsapp_click']) }))
      .toMatchObject({ event_key: 'whatsapp_click' })
  })

  it('distingue reservadas de las que no', () => {
    expect(isReservedEventKey('phone_click')).toBe(true)
    expect(isReservedEventKey('whatsapp_click')).toBe(false)
    expect(isEventKeyAllowed('form_submit', noneRegistered)).toBe(true)
    expect(isEventKeyAllowed('otra', noneRegistered)).toBe(false)
  })
})

describe('trackCore — scroll', () => {
  const base = { company_id: COMPANY, event_type: 'scroll_depth', path: '/servicios' }

  it('acepta solo los cuatro umbrales', () => {
    for (const value of [25, 50, 75, 100]) {
      expect(parseTrackPayload({ ...base, value })).toMatchObject({ event_type: 'scroll_depth', value })
    }
  })

  it('descarta cualquier otro valor', () => {
    for (const value of [0, 10, 30, 101, -5, 'mucho', null, undefined]) {
      expect(parseTrackPayload({ ...base, value })).toBeNull()
    }
  })

  it('el scroll de una página del panel no cuenta', () => {
    expect(parseTrackPayload({ ...base, path: '/ADMIN/items', value: 50 })).toBeNull()
  })
})

describe('trackCore — tiempo en página', () => {
  const base = { company_id: COMPANY, event_type: 'engagement', path: '/servicios' }

  it('guarda los segundos redondeados', () => {
    expect(parseTrackPayload({ ...base, value: 42.6 })).toMatchObject({ value: 43 })
  })

  it('una pestaña olvidada abierta se recorta, no se descarta ni infla la media', () => {
    expect(parseTrackPayload({ ...base, value: 999999 })).toMatchObject({ value: MAX_ENGAGEMENT_SECONDS })
  })

  it('menos de un segundo, cero, negativos y basura se descartan', () => {
    for (const value of [0, 0.2, -3, 'rato', null, NaN]) {
      expect(parseTrackPayload({ ...base, value })).toBeNull()
    }
  })
})

describe('trackCore — páginas no encontradas', () => {
  it('guarda la ruta que falló, limpia', () => {
    expect(parseTrackPayload({ company_id: COMPANY, event_type: 'not_found', path: '/viejo/12345678?x=1' }))
      .toMatchObject({ event_type: 'not_found', path: '/viejo/:token' })
  })

  it('no lleva clave ni valor', () => {
    const result = parseTrackPayload({ company_id: COMPANY, event_type: 'not_found', path: '/x', event_key: 'a', value: 5 })
    expect(result?.event_key).toBeUndefined()
    expect(result?.value).toBeUndefined()
  })
})
