# Bandeja de solicitudes — integrar en la web de un cliente

> **Prompt para empezar, dentro del proyecto de la web del cliente:**
>
> «Integra la bandeja de solicitudes de moira ordo en esta web siguiendo
> `company-site-snippet/LEADS_INTEGRATION.md`. El formulario de contacto debe
> guardar en la tabla `lead` a través de `/api/lead`.»

Todo lo que hay que hacer en cada web está en este fichero. Para registrar el
item consultado, aplica primero la migración aditiva
`database/migrations/CRM_LEAD_ITEM_ATTRIBUTION.sql`; los campos base de
solicitudes ya existen (`database/schema/LEADS_SCHEMA.sql`).

---

## Qué se consigue

Lo que hoy se pierde en un email (o directamente no se recoge) pasa a la
pestaña **Solicitudes** del panel, con estado *nueva → contactada → cerrada*,
buscador y notas internas. El CRM conserva la ruta de origen, el item consultado,
el referrer, la campaña y los cinco campos UTM cuando el formulario los envía.

## 1. Copiar los dos archivos

```
la-web-del-cliente/
├── api/
│   └── lead.ts          ← copiar de company-site-snippet/api/lead.ts
└── src/lib/
    └── leads.ts         ← copiar de company-site-snippet/lib/leads.ts
```

Si la web ya tiene la analítica integrada, `api/track.ts` y `lib/analytics.ts`
ya estarán ahí: estos dos se añaden al lado y usan las mismas variables de
entorno.

## 2. Variables de entorno (proyecto Vercel del cliente)

| Variable | Dónde | Valor |
|---|---|---|
| `SUPABASE_URL` | Servidor (sin prefijo) | La misma URL de Supabase que usa el admin panel |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor (sin prefijo, **nunca** `VITE_`) | Service role key de ese proyecto Supabase |
| `VITE_COMPANY_ID` | Cliente y servidor de esta web Vercel (es pública) | El `id` (uuid) de esta empresa en `companies`; el endpoint lo fija desde la configuración del despliegue y rechaza IDs distintos del cuerpo |

Si la analítica ya está integrada, las tres anteriores pueden existir. Añadir también `LEADS_RATE_LIMIT_SECRET`: secreto de servidor aleatorio de al menos 32 caracteres, sin prefijo VITE_. En Vercel, habilitar la exposición de variables de sistema y comprobar `VERCEL=1` en runtime; el edge proporciona `x-vercel-forwarded-for`. No sustituirlos por datos enviados en el formulario. Referencia: https://vercel.com/docs/environment-variables/system-environment-variables .

> La service role key se salta todos los permisos: va **solo** en el servidor.
> Si acaba en una variable `VITE_`, queda publicada en el JavaScript de la web.
> `VITE_COMPANY_ID` no es un secreto. El endpoint no confía en el valor enviado
> por el navegador para elegir empresa: lo compara con la configuración de
> este despliegue y usa el valor configurado al consultar e insertar.

## 3. Conectar el formulario

```tsx
import { useState } from 'react'
import { submitLead } from '../lib/leads'

// Cambia esta versión cada vez que cambie el texto de privacidad.
const LEAD_PRIVACY_TEXT_VERSION = 'contact-form-2026-10'

export function ContactForm() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError(null)

    const data = new FormData(event.currentTarget)
    const result = await submitLead({
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
  message: String(data.get('message') ?? ''),
      company_website: String(data.get('company_website') ?? ''), // trampa anti-bots
      consent_given: data.get('privacy_consent') === 'on',
      consent_text_version: LEAD_PRIVACY_TEXT_VERSION,
    })

    setSending(false)
    if (result.ok) setSent(true)
    else setError(
      result.reason === 'rate_limited'
        ? 'Has alcanzado el límite de envíos. Espera antes de volver a intentarlo; tus datos siguen en el formulario.'
        : result.reason === 'invalid'
          ? 'Revisa los datos: hacen falta tu nombre y un email o teléfono.'
          : 'No se ha podido enviar. Inténtalo de nuevo en un momento.'
    )
  }

  if (sent) return <p role="status">¡Gracias! Te responderemos lo antes posible.</p>

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="name">Nombre</label>
      <input id="name" name="name" required />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" />

      <label htmlFor="phone">Teléfono</label>
      <input id="phone" name="phone" type="tel" />

      <label htmlFor="message">¿En qué podemos ayudarte?</label>
      <textarea id="message" name="message" rows={4} />

      <label htmlFor="privacy_consent">
        <input id="privacy_consent" name="privacy_consent" type="checkbox" />
        He leído la <a href="/privacy-policy">información de privacidad</a> y acepto el tratamiento de mis datos según lo explicado allí.
      </label>

      {/* Trampa anti-bots: una persona nunca lo ve ni lo rellena.
          No usar display:none, que algunos bots detectan. */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
      />

      <button type="submit" disabled={sending}>
        {sending ? 'Enviando…' : 'Enviar'}
      </button>

      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

**Si la web es HTML plano**, sin React: importa `submitLead` igual y llama
desde un listener de `submit`, haciendo `event.preventDefault()`.

## 4. Reglas del formulario

- **Nombre obligatorio**, y **email o teléfono** (al menos uno). Una solicitud
  sin forma de contestar no sirve de nada: el servidor la rechaza con un 400.
- El campo trampa `company_website` **tiene que llegar vacío**. Si llega con
  algo, el servidor responde 200 y descarta la solicitud, para que el bot no
  reintente.
- Límites: nombre 120, email 160, teléfono 40, mensaje 4000 caracteres. Lo que
  pase se recorta, no se rechaza.
- `source_path`, `source_referrer` y los cinco campos UTM los rellena `lib/leads.ts`.
  En un formulario abierto desde una ficha, pasa además `source_item` con el
  título, slug o identificador público de esa ficha:
  `submitLead({ ...formValues, source_item: item.title + ' · ' + item.slug })`.
  En un formulario de contacto general, deja ese campo vacío. El servidor
  conserva solo el texto público (máximo 200 caracteres).
  La API registra `consent_given: true` solo cuando se marca la casilla y se
  envía una versión del texto. Si queda sin marcar, el lead se sigue enviando
  con `consent_given: false`; no se confunde la solicitud de respuesta con el
  consentimiento. El texto del ejemplo no sustituye la revisión de privacidad
  de cada empresa. Mantén la versión estable y cámbiala al modificar el texto.

Tras instalar `database/migrations/CRM_CONTACTS_PIPELINE.sql` y
`database/migrations/CRM_LEAD_ITEM_ATTRIBUTION.sql`, el servidor crea
o enlaza automáticamente el contacto al insertar la solicitud. La coincidencia
se calcula por email normalizado o teléfono. Si cada campo apunta a un contacto
distinto, queda `review_required` sin vinculación y el equipo debe resolverlo en
Contactos y pipeline. La web nunca debe decidir ni enviar un identificador de
contacto.

## 5. Si la web ya mide eventos

`submitLead` avisa **solo** a la analítica cuando la solicitud ha llegado a la
bandeja (un evento `moira:lead-sent` que recoge `lib/analytics.ts` y cuenta como
`form_submit`). No hay que hacer nada:

- Cuenta **solo los envíos que llegaron**, no los intentos fallidos.
- No pongas además `data-track-event="form_submit"` en el botón: se contaría
  dos veces.
- No hace falta dar de alta `form_submit` en el panel: es una clave reservada.

Así el número de *Formularios enviados* de la analítica y las solicitudes de la
bandeja coinciden, y la diferencia con las visitas a la página de contacto es la
tasa real de abandono. Si la analítica no está instalada, no pasa nada: el
evento se dispara y nadie lo escucha.

## 6. Comprobar que funciona

1. Rellena el formulario en el entorno de pruebas.
2. Abre el panel → **Solicitudes**, con esa empresa seleccionada.
3. Tiene que aparecer arriba, en estado **Nueva**.

Si no aparece:

| Síntoma | Causa más probable |
|---|---|
| 400 en `/api/lead` | Falta el nombre, faltan email y teléfono a la vez, o el ID enviado no coincide con `VITE_COMPANY_ID` de este despliegue. |
| 503 en `/api/lead` | Falta o no es válido `VITE_COMPANY_ID` en la configuración de servidor, o el módulo CRM está desactivado. |
| 500 en `/api/lead` | `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` mal puestas en Vercel. Mira los logs de la función. |
| 200 pero no aparece nada | El campo trampa llegó relleno: algún autocompletado lo está rellenando. Cámbiale el `name`. |
| Aparece en otra empresa | `VITE_COMPANY_ID` es el uuid de otra empresa. |

El endpoint también falla de forma cerrada si no existe la fila CRM de esa empresa en `company_modules`; revisa que `COMPANY_MODULES.sql` esté aplicado y que el módulo CRM se haya inicializado antes de habilitar el formulario público.

## 7. Privacidad

Estos datos los escribe la propia persona en un formulario de contacto, así
que es un tratamiento con una finalidad clara. Dos cosas que conviene tener:

- Una casilla de aceptación de la política de privacidad junto al botón.
- Que la política de privacidad diga que los datos de contacto se guardan para
  responder a la solicitud, y durante cuánto tiempo.
- Si se envía `source_item`, informar que también se conserva el item relacionado
  con la solicitud. No usar ese texto como autorización ni como dato verificado.

A diferencia de la analítica, aquí **sí** hay datos personales: no se puede
borrar la bandeja entera sin más, pero sí se pueden borrar solicitudes sueltas
desde el panel si alguien ejerce su derecho de supresión.

## Protección contra spam · auditoría, entrega 11

1. Aplicar `database/migrations/PUBLIC_LEAD_RATE_LIMIT.sql` tras COMPANY_MODULES en el proyecto Supabase correcto. Verificar que la RPC solo es ejecutable por service_role y las tablas no son accesibles desde el navegador.
2. Configurar `LEADS_RATE_LIMIT_SECRET` en servidor (aleatorio, mínimo 32 caracteres, por ejemplo generado con `openssl rand -hex 32`). Nunca usar VITE_ ni enviar el secreto al cliente. Mantenerlo estable entre instancias de la misma empresa.
3. Actualizar y redesplegar `api/lead.ts` y `lib/leads.ts` en cada web Vercel. No requiere publicar el panel ni Edge Functions. Fuera de Vercel se necesita una adaptación revisada del proxy de confianza; no hay fallback a cabeceras arbitrarias.
4. Adaptar el formulario al nuevo resultado `rate_limited`, conservar datos y permitir un reintento manual posterior. En español: «Has alcanzado el límite de envíos. Espera antes de volver a intentarlo». En inglés: «The submission limit has been reached. Please wait before trying again». No reintentar automáticamente.
5. Verificar un envío válido en Preview, el límite por origen, empresa manipulada, módulo CRM desactivado y fallo de la RPC. No usar datos reales ni agotar cuotas de clientes al probar.

Límites: cinco reservas por IP (prefijo /64 para IPv6) y empresa cada 15 minutos; 100 por empresa y hora. Son ventanas fijas: los bordes permiten ráfagas entre ventanas. Redes compartidas comparten cuota. El límite global protege el volumen de inserciones ante direcciones distribuidas, pero un abuso puede consumir la cuota de la empresa e impedir envíos legítimos hasta la siguiente ventana. No sustituye al firewall de Vercel frente a ataques volumétricos.

Se almacenan HMAC SHA-256 y contadores, sin IP en claro ni campos del contacto. Cambiar nombre, email, teléfono, user-agent o x-forwarded-for no reinicia la cuota. La dirección se toma solo de la cabecera del edge Vercel; referencia: https://vercel.com/docs/headers/request-headers . Si hay un proxy adicional, revisar identidad y cabecera efectiva antes de producción; no asumir que representa al visitante final.

Respuesta 429 con Retry-After: 3600 cuando se agota alguna cuota; 503 si falta secreto/plataforma/IP confiable/RPC o el módulo está desactivado. Se limita el cuerpo a 16 KiB reales y se responde 413 si los supera. La reserva se consume incluso si después falla la inserción del lead, para limitar intentos costosos. El honeypot se conserva como filtro adicional.

Cada bucket caduca a las tres horas de su inicio. Se limpian expirados de la empresa al reservar y se programa purga horaria si existe pg_cron. Verificar el job `purge-public-lead-rate-buckets`; si pg_cron no existe, programar externamente `purge_public_lead_rate_buckets` con service_role cada hora. Con la purga horaria funcionando, los buckets se conservan aproximadamente hasta cuatro horas; sin ejecutor de purga las empresas inactivas pueden retenerlos más tiempo.

Orden de despliegue: SQL → secreto/configuración → API y cliente → prueba controlada. La migración no envía correos ni modifica solicitudes existentes. PGlite valida cuotas y permisos con ejecuciones serializadas; falta verificar varias conexiones simultáneas y el scheduler real en entorno controlado.
