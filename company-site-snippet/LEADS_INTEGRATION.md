# Bandeja de solicitudes — integrar en la web de un cliente

> **Prompt para empezar, dentro del proyecto de la web del cliente:**
>
> «Integra la bandeja de solicitudes de moira ordo en esta web siguiendo
> `company-site-snippet/LEADS_INTEGRATION.md`. El formulario de contacto debe
> guardar en la tabla `lead` a través de `/api/lead`.»

Todo lo que hay que hacer está en este fichero. No hace falta tocar el admin
panel ni la base de datos: la tabla `lead` y sus permisos ya existen
(`database/schema/LEADS_SCHEMA.sql`).

---

## Qué se consigue

Lo que hoy se pierde en un email (o directamente no se recoge) pasa a la
pestaña **Solicitudes** del panel, con estado *nueva → contactada → cerrada*,
buscador y notas internas. Cada solicitud guarda además desde qué página se
envió y la campaña (`utm_campaign`), para saber qué páginas traen clientes.

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
| `VITE_COMPANY_ID` | Cliente (con prefijo `VITE_`, es pública) | El `id` (uuid) de esta empresa en la tabla `companies` |

Si la analítica ya está integrada, las tres existen y no hay que tocar nada.

> La service role key se salta todos los permisos: va **solo** en el servidor.
> Si acaba en una variable `VITE_`, queda publicada en el JavaScript de la web.

## 3. Conectar el formulario

```tsx
import { useState } from 'react'
import { submitLead } from '../lib/leads'

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
    })

    setSending(false)
    if (result.ok) setSent(true)
    else setError(
      result.reason === 'invalid'
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
- `source_path` y `source_campaign` los rellena `lib/leads.ts` solo, con la
  URL actual. No hay que pasarlos.

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
| 400 en `/api/lead` | Falta el nombre, o faltan email y teléfono a la vez; o `VITE_COMPANY_ID` no es un uuid de `companies`. |
| 500 en `/api/lead` | `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` mal puestas en Vercel. Mira los logs de la función. |
| 200 pero no aparece nada | El campo trampa llegó relleno: algún autocompletado lo está rellenando. Cámbiale el `name`. |
| Aparece en otra empresa | `VITE_COMPANY_ID` es el uuid de otra empresa. |

## 7. Privacidad

Estos datos los escribe la propia persona en un formulario de contacto, así
que es un tratamiento con una finalidad clara. Dos cosas que conviene tener:

- Una casilla de aceptación de la política de privacidad junto al botón.
- Que la política de privacidad diga que los datos de contacto se guardan para
  responder a la solicitud, y durante cuánto tiempo.

A diferencia de la analítica, aquí **sí** hay datos personales: no se puede
borrar la bandeja entera sin más, pero sí se pueden borrar solicitudes sueltas
desde el panel si alguien ejerce su derecho de supresión.
