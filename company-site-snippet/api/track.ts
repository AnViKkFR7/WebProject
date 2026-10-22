// api/track.ts — Vercel Serverless Function (Node runtime), a copiar en el
// proyecto Vercel de CADA web de empresa. Código idéntico para todas.
//
// Recibe los eventos de medición y los guarda en analytics_events. La web NO
// escribe directamente en Supabase: la tabla no tiene política de insert.
//
// Qué decide el SERVIDOR y no el navegador (para que no se pueda falsear):
//   - quién: hash anónimo del visitante (sal del día + IP + user-agent)
//   - desde dónde: país/región/ciudad de las cabeceras del hosting
//   - con qué: móvil / tableta / escritorio, del user-agent
//
// Variables de entorno requeridas en el proyecto Vercel de la empresa:
//   SUPABASE_URL                  (misma instancia Supabase de moira ordo)
//   SUPABASE_SERVICE_ROLE_KEY     (NUNCA con prefijo VITE_)
//   ANALYTICS_SALT                cadena larga al azar, distinta por entorno
//                                 (openssl rand -hex 32). Se combina con la
//                                 sal diaria de la base de datos.
import { createClient } from '@supabase/supabase-js'
// Ruta tal y como queda en el proyecto de la web: api/ en la raíz y el
// núcleo en src/lib/ (en este repo de snippets el núcleo está en lib/).
import {
  businessDay, deviceFromUa, geoFromHeaders, isBot, isEventKeyAllowed, isSameOrigin, parseTrackPayload, visitorHash,
} from '../src/lib/trackCore'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// La medición nunca debe romper la web ni delatar nada: pase lo que pase se
// responde 204 y el navegador no reintenta.
const noContent = () => new Response(null, { status: 204 })

// Caché en memoria de la instancia "caliente": evita consultar en cada clic
let definitionsCache: { companyId: string; keys: Set<string>; expiresAt: number } | null = null

async function activeEventKeys(companyId: string): Promise<Set<string>> {
  if (definitionsCache?.companyId === companyId && definitionsCache.expiresAt > Date.now()) {
    return definitionsCache.keys
  }
  const { data } = await supabase
    .from('analytics_event_definitions')
    .select('key')
    .eq('company_id', companyId)
    .eq('is_active', true)
  const keys = new Set((data ?? []).map((row) => row.key as string))
  definitionsCache = { companyId, keys, expiresAt: Date.now() + 5 * 60 * 1000 }
  return keys
}

// La sal del día se pide a la base de datos y se guarda solo la de hoy
let saltCache: { day: string; salt: string } | null = null

async function dailySalt(day: string): Promise<string | null> {
  if (saltCache?.day === day) return saltCache.salt
  const { data, error } = await supabase.rpc('analytics_salt', { p_day: day })
  if (error || typeof data !== 'string') return null
  saltCache = { day, salt: data }
  return data
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const get = (header: string) => req.headers.get(header)

  // Sin configuración no se guarda nada, pero tampoco se avisa
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ANALYTICS_SALT) {
    return noContent()
  }

  // Bots y peticiones que no vienen de la propia web
  const userAgent = get('user-agent') ?? ''
  if (isBot(userAgent)) return noContent()
  if (!isSameOrigin(get)) return noContent()

  const raw = await req.text()
  if (raw.length > 4000) return noContent()

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return noContent()
  }

  const ownHost = get('x-forwarded-host') ?? get('host') ?? undefined
  const preliminary = parseTrackPayload(body, { ownHost })
  if (!preliminary) return noContent()

  // Un clic con una clave que la empresa no ha dado de alta se descarta,
  // salvo las reservadas (teléfono, email, formulario), que valen siempre.
  // Para esas no hace falta ni consultar la base de datos.
  if (preliminary.event_type === 'cta_click') {
    if (!preliminary.event_key) return noContent()
    const keys = await activeEventKeys(preliminary.company_id)
    if (!isEventKeyAllowed(preliminary.event_key, keys)) return noContent()
  }

  // company_id debe existir: evita inyectar tráfico en otra empresa
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', preliminary.company_id)
    .maybeSingle()
  if (!company) return noContent()

  const day = businessDay(new Date())
  const salt = await dailySalt(day)
  if (!salt) return noContent()

  const ip = get('x-real-ip') ?? get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const visitor = await visitorHash(`${salt}:${process.env.ANALYTICS_SALT}`, day, ip, userAgent)
  const geo = geoFromHeaders(get)

  const { error } = await supabase.from('analytics_events').insert({
    company_id: preliminary.company_id,
    event_type: preliminary.event_type,
    event_key: preliminary.event_key ?? null,
    value: preliminary.value ?? null,
    path: preliminary.path ?? null,
    visitor,
    device: deviceFromUa(userAgent),
    country: geo.country,
    region: geo.region,
    city: geo.city,
    lang: preliminary.lang ?? null,
    referrer: preliminary.referrer ?? null,
    utm_source: preliminary.utm_source ?? null,
    utm_medium: preliminary.utm_medium ?? null,
    utm_campaign: preliminary.utm_campaign ?? null,
  })

  // Un fallo al guardar tampoco se le cuenta al navegador
  if (error) console.error('[track] insert failed', error.message)
  return noContent()
}

export const config = { runtime: 'nodejs' }
