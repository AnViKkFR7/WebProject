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

const MAX = { name: 120, email: 160, phone: 40, message: 4000, path: 300, campaign: 120 }

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
  const name = clean(body.name, MAX.name)
  const email = clean(body.email, MAX.email)
  const phone = clean(body.phone, MAX.phone)
  const message = clean(body.message, MAX.message)

  // El nombre y alguna forma de contestar son imprescindibles: una solicitud
  // sin email ni teléfono no sirve de nada en la bandeja.
  if (!company_id || !name || (!email && !phone)) {
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
    .eq('id', company_id)
    .maybeSingle()
  if (!company) return new Response('Bad request', { status: 400 })

  const { error } = await supabase.from('lead').insert({
    company_id,
    name,
    email,
    phone,
    message,
    source_path: clean(body.source_path, MAX.path),
    source_campaign: clean(body.source_campaign, MAX.campaign),
  })

  if (error) {
    console.error('[lead] insert failed', error)
    return new Response('Server error', { status: 500 })
  }

  return new Response('OK', { status: 201 })
}
