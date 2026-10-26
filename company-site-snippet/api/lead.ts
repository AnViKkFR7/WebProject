// api/lead.ts — Vercel Serverless Function (Node runtime), a copiar en el
// proyecto Vercel de CADA web de empresa. Código idéntico para todas.
//
// Recibe el formulario de contacto y lo guarda en la bandeja de solicitudes
// del admin panel (tabla `lead`). La web NO escribe directamente en Supabase:
// la tabla no tiene política de insert para la clave pública, a propósito,
// para que nadie pueda llenarla de basura.
//
// Variables de entorno requeridas en el proyecto Vercel de la empresa:
//   SUPABASE_URL                  (misma instancia Supabase de moira ordo)
//   SUPABASE_SERVICE_ROLE_KEY     (NUNCA con prefijo VITE_)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX = { name: 120, email: 160, phone: 40, message: 4000, path: 300, item: 200, referrer: 500, campaign: 120 }

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

// Validación mínima: que parezca un email. No se comprueba que exista.
const looksLikeEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const company_id = clean(body.company_id, 64)
  // The public request body is not an authority for tenant selection. Pin the
  // write to the company configured on this Vercel deployment and reject a
  // modified/misconfigured client before using the service-role key.
  const configuredCompanyId = clean(process.env.VITE_COMPANY_ID, 64)
  const name = clean(body.name, MAX.name)
  const email = clean(body.email, MAX.email)
  const phone = clean(body.phone, MAX.phone)
  const message = clean(body.message, MAX.message)
  const consentVersion = clean(body.consent_text_version, 80)
  const consentGiven = body.consent_given === true && Boolean(consentVersion)

  // El nombre y alguna forma de contestar son imprescindibles: una solicitud
  // sin email ni teléfono no sirve de nada en la bandeja.
  if (!configuredCompanyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(configuredCompanyId)) {
    return new Response('Service unavailable', { status: 503 })
  }
  if (!company_id || company_id !== configuredCompanyId || !name || (!email && !phone)) {
    return new Response('Bad request', { status: 400 })
  }
  if (email && !looksLikeEmail(email)) {
    return new Response('Bad request', { status: 400 })
  }

  // Trampa anti-bots: un campo oculto que una persona nunca rellena.
  // Se responde 200 para que el bot crea que ha funcionado y no reintente.
  if (clean(body.company_website, 200)) return new Response('OK', { status: 200 })

  // company_id debe existir — evita que alguien meta solicitudes en la
  // bandeja de otra empresa.
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', configuredCompanyId)
    .maybeSingle()
  if (!company) return new Response('Bad request', { status: 400 })

  const { data: crmModule, error: moduleError } = await supabase.from('company_modules')
    .select('is_enabled').eq('company_id', company_id).eq('module_key', 'crm').maybeSingle()
  // Missing module configuration must fail closed as well: otherwise a
  // partially applied module migration would keep accepting public requests.
  if (moduleError || !crmModule || !crmModule.is_enabled) return new Response('Requests are unavailable', { status: 503 })

  const { error } = await supabase.from('lead').insert({
    company_id: configuredCompanyId,
    name,
    email,
    phone,
    message,
    source_path: clean(body.source_path, MAX.path),
    source_item: clean(body.source_item, MAX.item),
    source_campaign: clean(body.source_campaign, MAX.campaign),
    source_referrer: clean(body.source_referrer, MAX.referrer),
    source_utm_source: clean(body.source_utm_source, MAX.campaign),
    source_utm_medium: clean(body.source_utm_medium, MAX.campaign),
    source_utm_term: clean(body.source_utm_term, MAX.campaign),
    source_utm_content: clean(body.source_utm_content, MAX.campaign),
    consent_given: consentGiven,
    consent_at: consentGiven ? new Date().toISOString() : null,
    consent_text_version: consentGiven ? consentVersion : null,
    consent_source: consentGiven ? 'public_contact_form' : null,
  })

  if (error) {
    console.error('[lead] insert failed', error)
    return new Response('Server error', { status: 500 })
  }

  return new Response('OK', { status: 201 })
}
