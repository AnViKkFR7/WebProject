// lib/leads.ts — a copiar en el proyecto de CADA web de empresa.
// Código idéntico para todas salvo la variable de entorno VITE_COMPANY_ID.
//
// Envía el formulario de contacto a /api/lead, que lo guarda en la bandeja
// de solicitudes del admin panel.
//
// Variable de entorno requerida (esta sí con prefijo VITE_, es pública):
//   VITE_COMPANY_ID   (uuid de esta empresa en la tabla companies)
const ENDPOINT = '/api/lead'
const COMPANY_ID = import.meta.env.VITE_COMPANY_ID

export interface LeadInput {
  name: string
  email?: string
  phone?: string
  message?: string
  /** Campo trampa: debe llegar vacío. Ver el input oculto del formulario. */
  company_website?: string
}

export type LeadResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'network' | 'server' }

/**
 * Envía una solicitud. A diferencia de la analítica no usa sendBeacon:
 * aquí hay que saber si ha llegado para poder decírselo a la persona.
 */
export async function submitLead(input: LeadInput): Promise<LeadResult> {
  if (!COMPANY_ID) {
    console.warn('[leads] VITE_COMPANY_ID no está configurado — solicitud descartada')
    return { ok: false, reason: 'invalid' }
  }
  if (!input.name?.trim() || (!input.email?.trim() && !input.phone?.trim())) {
    return { ok: false, reason: 'invalid' }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: COMPANY_ID,
        ...input,
        source_path: window.location.pathname,
        source_campaign: new URLSearchParams(window.location.search).get('utm_campaign') ?? undefined,
      }),
    })
    if (response.ok) {
      // Avisa a la analítica (lib/analytics.ts, si está instalada) de que ha
      // habido un envío. Se hace AQUÍ, tras la respuesta del servidor, y no en
      // el clic del botón: así el número de la analítica es el de solicitudes
      // que de verdad llegaron a la bandeja, y no el de intentos. Es un evento
      // del DOM para que este fichero no dependa de analytics.ts.
      window.dispatchEvent(new CustomEvent('moira:lead-sent'))
      return { ok: true }
    }
    return { ok: false, reason: response.status === 400 ? 'invalid' : 'server' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
