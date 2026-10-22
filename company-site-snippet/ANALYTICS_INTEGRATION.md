# Analítica — integrar en la web de un cliente

> **Prompt para empezar, dentro del proyecto de la web del cliente:**
>
> «Integra la analítica de moira ordo en esta web siguiendo
> `company-site-snippet/ANALYTICS_INTEGRATION.md`. Copia `trackCore.ts`,
> `analytics.ts`, `consent.ts` y `api/track.ts`, arranca el seguimiento en el
> punto de entrada, llama a `trackNotFound()` desde la página 404 y añade el
> banner de cookies.»

Mide visitas y clics **sin cookies y sin identificar a nadie**. Lo que se ve
está en la pestaña **Analítica** del panel.

---

## Lo que hay que entender antes de copiar nada

Son **dos cosas distintas** y el banner tiene que distinguirlas:

| | Medición propia | Cookies de terceros (GA4, Meta) |
|---|---|---|
| ¿Toca el dispositivo? | **No**: ni cookies ni `localStorage` | Sí |
| ¿Necesita consentimiento previo? | **No** (LSSI 22.2). Va por interés legítimo, con derecho a oponerse | **Sí**, explícito y previo |
| ¿Qué pasa si rechazan cookies? | **Sigue midiendo** | No se cargan |
| ¿Cuándo se apaga? | Si la persona se opone, o si su navegador manda Global Privacy Control | Siempre que no acepten |

> Esto es lo que más se suele hacer mal: poner la medición propia detrás del
> botón «Aceptar» del banner. No hace falta, y perderías la mitad de los datos.

**El navegador dice qué pasó; el servidor decide quién, desde dónde y con qué.**
El navegador manda el tipo de evento, la ruta, el idioma y de dónde viene la
visita. El servidor añade el visitante (hash anónimo), el país y el
dispositivo. Así nadie puede falsear su identidad desde el cliente.

---

## Qué se mide

Con solo copiar los archivos y llamar a `initAutoTracking()`, **sin tocar el
HTML** de la web:

| Qué | Cómo se ve en el panel | Cómo se mide |
|---|---|---|
| Visitas y páginas vistas | Tráfico, páginas más vistas | Una vista por cambio de ruta |
| **Clics en teléfono** | Conversiones → *Clics en teléfono* | Cualquier enlace `tel:` |
| **Clics en email** | Conversiones → *Clics en email* | Cualquier enlace `mailto:` |
| **Formulario enviado** | Conversiones → *Formularios enviados* | Automático al usar `submitLead` (ver abajo) |
| **Hasta dónde se lee** cada página | Tabla de lectura: % de visitas que llega al 25 / 50 / 75 / 100 % | Evento de scroll, una vez por umbral y página |
| **Tiempo en la página** | Reparto por tramos y % de visitas de menos de 10 s | Reloj con la pestaña visible |
| **Páginas que no existen** | Lista de URLs rotas y cuántas veces se pidieron | Hay que llamar a `trackNotFound()` desde la página 404 |
| Clics propios (`data-track-event`) | Eventos | Como hasta ahora |

### Teléfono, email y formulario valen sin darlos de alta

`phone_click`, `email_click` y `form_submit` son **claves reservadas**: el
servidor las acepta en todas las empresas sin registrarlas en el panel, igual
que `page_view`. Antes, un clic con una clave no registrada se descartaba en
silencio, y que un cliente olvidara darla de alta significaba perder datos sin
enterarse. Las claves propias (`whatsapp_click`, `reservar_click`…) siguen
necesitando estar dadas de alta y activas.

Si un enlace tiene **su propio** `data-track-event`, manda esa clave en vez de
`phone_click`: así un cliente puede distinguir «llamar a oficina» de «llamar a
urgencias» si lo necesita.

### Formulario de contacto

Si el formulario usa `submitLead` (ver `LEADS_INTEGRATION.md`), el envío se
cuenta **solo y solo cuando la solicitud ha llegado** a la bandeja. No pongas
además `data-track-event="form_submit"` en el botón: contaría dos veces, y
contaría también los intentos que fallan. Para un formulario que **no** use
`submitLead`, sí puedes ponérselo al botón; esa clave no hace falta registrarla.

### Página 404

Llama a `trackNotFound()` cuando se pinte la página «no encontrada». Con React:

```tsx
import { useEffect } from 'react'
import { trackNotFound } from '../lib/analytics'

export function NotFoundPage() {
  useEffect(() => { trackNotFound() }, [])
  return <h1>Esta página no existe</h1>
}
```

En una web de HTML plano, en el `404.html`:
`<script type="module">import { trackNotFound } from '/lib/analytics.js'; trackNotFound()</script>`.

Guarda la URL que falló y, si la persona llegó **directamente** a ella desde otra
web, el dominio de origen: es el dato que permite pedirle a quien enlaza que
corrija el enlace. Si el router ya manda un `page_view` para la 404, esa ruta
saldrá también en «Páginas más vistas»; es normal.

### Cómo se interpretan los datos nuevos

- **Lectura**: el porcentaje es sobre las visitas **de esa página**. Una página
  con un 80 % en el 25 % y un 8 % en el 100 % se abandona a mitad: o es muy
  larga, o el contenido no engancha. Las páginas que apenas se desplazan (menos
  de 200 px de recorrido) **no se miden**: llegar «al 100 %» sin moverse no
  dice nada.
- **Tiempo**: solo cuenta con la pestaña visible; dejarla abierta de fondo no
  es leer. Si alguien se va a otra pestaña y vuelve, cuenta como **dos tramos**
  de la misma visita. Es una aproximación y el panel lo dice. Se recorta a 2 h
  para que una pestaña olvidada no falsee las medias.
- **«Rebote»** aquí significa una visita de **menos de 10 segundos** con la
  pestaña visible. No es el rebote clásico de otras herramientas (una sola
  página vista), y no deben compararse cifras entre una y otra.

## 1. Copiar los cuatro archivos

```
la-web-del-cliente/
├── api/
│   └── track.ts          ← company-site-snippet/api/track.ts
└── src/lib/
    ├── trackCore.ts      ← company-site-snippet/lib/trackCore.ts
    ├── analytics.ts      ← company-site-snippet/lib/analytics.ts
    └── consent.ts        ← company-site-snippet/lib/consent.ts
```

`api/track.ts` importa `../src/lib/trackCore`: si tu proyecto no usa `src/`,
ajusta esa ruta.

Copia también `lib/trackCore.test.ts` si el proyecto tiene tests: comprueba lo
que de verdad importa (que la ruta no guarde ids, que el panel no cuente como
tráfico, que el hash del visitante cambie cada día).

## 2. Variables de entorno (proyecto Vercel del cliente)

| Variable | Dónde | Valor |
|---|---|---|
| `SUPABASE_URL` | Servidor | La misma URL de Supabase que usa el panel |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor, **nunca** `VITE_` | Service role key de ese proyecto |
| `ANALYTICS_SALT` | Servidor | Cadena larga al azar: `openssl rand -hex 32`. Distinta por entorno |
| `VITE_COMPANY_ID` | Cliente (pública) | El `id` (uuid) de esta empresa en `companies` |

Sin las tres de servidor el endpoint responde `204` y no guarda nada, en
silencio. La medición nunca rompe la web.

> `ANALYTICS_SALT` se combina con una sal que cambia cada día y se borra a las
> 48 h. Si la cambias, los visitantes únicos de ese día empiezan de cero.

## 3. Arrancar el seguimiento

En el punto de entrada (`main.tsx` o equivalente):

```ts
import { initAutoTracking, trackPageview } from './lib/analytics'

initAutoTracking()   // una sola vez: respeta GPC y la decisión guardada
```

**El orden importa**: `initAutoTracking()` va **antes** que la primera llamada a
`trackPageview`. Es quien pone en marcha el reloj del tiempo en página; si se
llama después, la primera página sale sin tiempo.

Y en el listener de cambio de ruta del router:

```ts
trackPageview(window.location.pathname)
```

En una web multipágina (sin router) basta `initAutoTracking()`: cada carga es
una vista.

**Clics**, sin JavaScript por botón:

```html
<button data-track-event="whatsapp_click">Escríbenos por WhatsApp</button>
```

La clave (`whatsapp_click`) tiene que estar dada de alta y activa en la
pestaña Analítica del panel. Si no, el servidor la descarta en silencio. El
panel enseña el atributo exacto a copiar junto a cada evento.

## 4. Banner de cookies

El snippet trae la lógica (`consent.ts`), no el diseño: cada web tiene el
suyo. Lo que el banner **tiene que** hacer:

```ts
import { readConsent, writeConsent, measurementAllowed, needsDecision } from './lib/consent'
import { setMeasurement } from './lib/analytics'

const consent = readConsent()
if (needsDecision(consent)) mostrarBanner()

// Al decidir:
function decidir(opciones: { analytics: boolean; marketing: boolean; measurement: boolean }) {
  const guardado = writeConsent(opciones)
  setMeasurement(measurementAllowed(guardado))   // surte efecto sin recargar
  // aquí cargas o descargas GA4 / Meta según opciones.analytics y .marketing
}
```

Reglas:

- **Tres interruptores**, no uno: *Medición sin cookies* · *Analítica* ·
  *Publicidad*. Más la fila de «Necesarias», fija.
- «Solo necesarias» pone `analytics` y `marketing` a `false` pero **deja
  `measurement` como esté** (activo por defecto).
- El banner va **fijo abajo** y no empuja el contenido, para no mover la
  página al cargar.
- Si la web es prerenderizada, no pintes el banner hasta que hidrate: si no,
  parpadea a quien ya decidió.
- Un enlace «Preferencias de cookies» en el pie para poder cambiar de opinión.
- La decisión caduca al año y tiene versión: si cambian las finalidades, sube
  `CONSENT_VERSION` y se vuelve a preguntar.

## 5. Qué se guarda y qué no

**Sí**: visitante-hash del día, tipo de evento, ruta normalizada, país, región
y ciudad (por IP, lo da el hosting), dispositivo, idioma del navegador,
dominio de origen y UTM de la primera vista. Con las mejoras: hasta qué punto
se baja cada página (25 / 50 / 75 / 100 %) y cuántos segundos se está en ella.
Ninguno de los dos identifica a nadie.

**No**: la IP, el user-agent completo, cookies, identificadores persistentes,
la URL con su query, nombres, emails ni teléfonos.

**Protecciones que ya vienen puestas**:

| Riesgo | Qué lo evita |
|---|---|
| Datos personales en la URL (`/pedido/12345`) | `normalizePath` los sustituye por `:id` / `:token` |
| Bots y Lighthouse inflando las visitas | `isBot` por user-agent; un UA vacío también es bot |
| Alguien metiendo tráfico falso desde otra web | `isSameOrigin` (`Sec-Fetch-Site` / `Origin`) |
| Inundar la tabla desde un navegador | Tope de 500 eventos por visitante y 24 h, en la base de datos |
| Seguir a una persona entre días | La sal cambia a diario y se borra a las 48 h |
| El tráfico interno del panel contando como visitas | Se descarta `/admin` (también `/ADMIN`) |
| Volver de Stripe/PayPal apareciendo como «fuente» | Lista de dominios que no son fuente |

**Retención**: los eventos en crudo se purgan a los 35 días; el resumen diario
(sin visitante) se conserva.

## 6. Comprobar que funciona

1. Despliega a producción. **En desarrollo no se mide a propósito**, para no
   ensuciar los datos del cliente.
2. Entra en la web y navega por un par de páginas.
3. Panel → **Analítica**, con esa empresa seleccionada → «Actualizar ahora».

| Síntoma | Causa más probable |
|---|---|
| No aparece nada | `VITE_COMPANY_ID` vacío o de otra empresa. Mira la consola: avisa |
| Las visitas no suben | ¿Estás en desarrollo? Solo mide en producción |
| Los clics no cuentan | La clave no está dada de alta o está desactivada en el panel |
| Visitantes únicos = páginas vistas | Falta `ANALYTICS_SALT`, o la RPC `analytics_salt` no existe: ejecuta `ANALYTICS_PRIVACY_UPGRADE.sql` |
| Todo sale como «(directo)» | Normal si llegan escribiendo la URL. Prueba con `?utm_source=prueba` |
| El teléfono o el email salen a 0 | ¿Los enlaces son `<a href="tel:...">` / `mailto:...`? Un botón con JavaScript que abre el marcador no es un enlace |
| No sale ninguna página en «Hasta dónde se lee» | Las páginas muy cortas no se miden. Prueba en una larga, bajando hasta el final |
| El tiempo sale vacío | Falta `initAutoTracking()` o se llama después de `trackPageview` |
| No salen las páginas 404 | Falta llamar a `trackNotFound()` en la página «no encontrada» |
| Las columnas nuevas no se rellenan | Falta ejecutar `ANALYTICS_ENGAGEMENT.sql` **y volver a ejecutar** `ANALYTICS_AGGREGATION.sql` |

## 7. Legal

Hace falta una **política de cookies** que describa **las dos capas** y su
base jurídica: la medición propia por interés legítimo (con derecho de
oposición) y las cookies de terceros por consentimiento. Esto no es opcional
y no lo cubre el código.

Este diseño sigue el criterio español (LSSI art. 22.2 + RGPD 6.1.f y 21).
Para otro país, que lo revise quien corresponda.
