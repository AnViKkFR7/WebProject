# Analíticas web con y sin cookies: cómo está hecho en este proyecto

> **Para quién es este documento**: para otra IA (o una persona) que tenga que implementar lo
> mismo en otro proyecto web. Describe la arquitectura, las decisiones y **por qué** se tomaron,
> con el código clave. Todo está sacado del código real de este repositorio (rutas indicadas);
> donde algo es específico de aquí (Vercel, Supabase, zona horaria de Madrid) se dice cómo
> adaptarlo. Léelo entero antes de escribir código: las decisiones de privacidad condicionan
> el diseño.

---

## 0. Resumen en 30 segundos

Hay **dos sistemas independientes** que conviven:

| | **A. Medición propia sin cookies** | **B. Analítica de marketing con cookies** |
|---|---|---|
| Qué es | Un endpoint propio (`POST /api/track`) que guarda eventos anónimos en nuestra base de datos | Google Analytics 4 + píxel de Meta (+ Google Ads) |
| Cookies / almacenamiento en el dispositivo | **Ninguno** | Sí (`_ga`, `_gid`, `_gcl*`, `_fbp`, `_fbc`) |
| Consentimiento | No lo necesita (LSSI art. 22.2: no accede al dispositivo). Se basa en **interés legítimo** (RGPD 6.1.f): activa por defecto, con **opción de oponerse** (art. 21) | **Sí, explícito** y previo. Cargan solo después de aceptar |
| Para qué sirve | Visitas, embudo de reserva, errores, demanda no atendida, uso de APIs de pago. Se ve en el panel propio `/admin/analiticas` | Campañas, remarketing, conversiones en Google/Meta |
| Dónde se ve | Panel propio (agregados) | Google Analytics / Meta |
| Entornos | Solo producción (en dev apagado salvo que se configure) | Solo producción |

Un **banner de cookies** con tres interruptores (medición sin cookies · analítica · publicidad)
gobierna ambos. Rechazar las cookies **no** apaga la medición propia (a propósito: es anónima y
sin cookies); solo se apaga si la persona se opone en el panel de cookies o su navegador manda la
señal **Global Privacy Control (GPC)**.

```
Navegador                                        Servidor
─────────                                        ────────
CookieBanner ──decide()──▶ consentStore (localStorage "vtc.consent.v1")
     │                          │
     ▼                          ▼
applyConsent(consent)     measurementAllowed()
  ├─ GA4 / Meta (solo si consentimiento + prod)       │
  └─ setMeasurement(on) ──▶ firstParty.send() ──sendBeacon──▶ POST /api/track
                                                              │ valida · descarta bots
                                                              │ visitante = hash(sal día+IP+UA)
                                                              ▼
                                                  tabla analytics_events (solo service_role)
                                                              │ cron nocturno
                                                              ▼
                                       analytics_daily (resumen) ──RPC solo staff──▶ /admin/analiticas
```

---

## 1. Decisiones de diseño (léelas antes de codificar)

1. **Dos capas, no una.** Lo que no necesita cookies (contar visitas, embudo) se hace sin ellas
   para poder medir al 100 % de la gente sin banner bloqueante. Lo que sí las necesita
   (GA4, Meta) solo se carga con consentimiento.
2. **La IP nunca se guarda.** El «visitante» es un hash `SHA-256(sal_del_día | IP | user-agent)`
   truncado a 24 caracteres. Sirve para contar únicos **dentro de un día**; no permite seguir a nadie
   entre días porque la sal cambia. La sal del día es **aleatoria, la genera la BD y se destruye a las
   48 h**: pasado ese plazo ni con la IP se puede recalcular de quién era un hash.
3. **El servidor decide lo sensible, el navegador solo informa.** El navegador manda tipo de evento,
   ruta, paso del embudo, idioma, referrer y UTM. El **servidor** añade país/región/ciudad (cabeceras
   de geolocalización del hosting), dispositivo (del user-agent) y el hash del visitante. El
   navegador no puede falsificar ni elegir su identidad.
4. **Se guarda lo mínimo y se limpia.** Eventos en bruto 90 días; luego solo un resumen diario
   agregado. Rutas sin referencias de reserva ni identificadores. Referrer solo como dominio.
5. **Quien lee es el staff, y solo agregados.** La tabla de eventos no tiene políticas RLS: nadie
   salvo `service_role` la lee ni la escribe. El panel consulta funciones SQL (`security definer`)
   que devuelven JSON agregado y exigen ser staff.
6. **La medición nunca rompe la web.** Todo en `try/catch`, `sendBeacon` sin esperar, el endpoint
   responde siempre `204` (incluso si descarta o falla): ni errores visibles ni reintentos.
7. **Defensa contra abuso del endpoint público**: solo misma web (`Sec-Fetch-Site`/`Origin`),
   cuerpo máx. 4 KB, validación estricta con listas blancas, descarte de bots y tope de 500
   eventos por visitante y 24 h en la BD.
8. **Consentimiento versionado y caducado.** Se guarda en `localStorage` (almacenamiento
   estrictamente necesario) con `version` y `decidedAt`. Si cambian las finalidades se sube la versión
   y se vuelve a preguntar; caduca a los 12 meses.
9. **Retirar el consentimiento corta en el acto**: se actualiza Consent Mode, se borran las cookies
   de GA/Meta y se deja de enviar eventos sin recargar la página.

---

## 2. Mapa de ficheros

Front (`web/src/features/analytics/`):

| Fichero | Responsabilidad |
|---|---|
| `consentStore.ts` | Tipo `Consent`, lectura/validez de la decisión guardada, GPC, `measurementAllowed()`. **Sin React** (lo leen otros módulos). |
| `consent.tsx` | `ConsentProvider` + hook `useConsent()` (estado React, `decide()`, `reopen()`). Al cambiar la decisión llama a `applyConsent`. |
| `CookieBanner.tsx` | Banner fijo abajo (no empuja el contenido: sin CLS) + modal «Configurar» con 3 interruptores. |
| `trackers.ts` | GA4 y Meta: carga diferida, Consent Mode v2, borrado de cookies, `track()`, `trackError()`, `trackAction()`, `trackFormStart()`. |
| `firstParty.ts` | Cliente de la medición propia: `fpPageView`, `fpFunnel`, `fpError`, `fpAction`, `countApiCall`; envía con `sendBeacon`. |
| `trackCore.ts` | **Núcleo puro y con tests**, compartido front/servidor: validación, normalización de rutas, hash del visitante, bots, dispositivo, geolocalización, fila a insertar. |
| `attribution.ts` | De dónde viene la visita (UTM, `gclid`, `fbclid`, referrer) y cómo se guarda según el consentimiento. |
| `index.ts` | API pública del módulo. |

Servidor y BD:

| Fichero | Responsabilidad |
|---|---|
| `web/api/track.ts` | Función serverless (Vercel) `POST /api/track`. |
| `supabase/migrations/20261003000100_settings_analytics.sql` | Tablas `analytics_events`, `analytics_daily`, `quote_log`, `api_usage_daily`; resumen diario; RPCs del panel; cron nocturno. |
| `supabase/migrations/20261004000100_settings_analytics_hardening.sql` | Sal diaria aleatoria (`analytics_salts`), tope por visitante, limpieza de sales. |
| `supabase/functions/_shared/quoteLog.ts` + `quote/index.ts` | Registro anónimo del cotizador (demanda atendida y no atendida). |
| `web/src/pages/admin/AdminAnalyticsPage.tsx` | Panel `/admin/analiticas`. |

Sitios donde se engancha:

- `web/src/app/App.tsx` y `web/src/prerender.tsx`: envuelven la app en `<ConsentProvider>`.
- `web/src/components/layout/AppLayout.tsx`: `captureAttribution()` al montar, `fpPageView(pathname)` en cada cambio de ruta (salvo el panel de admin) y `<CookieBanner />`.
- `BookingForm.tsx`: `trackFormStart()` en la primera interacción con el formulario.
- Cotización, checkout y confirmación: `track('view_item_list' | 'select_item' | 'begin_checkout' | 'add_payment_info' | 'purchase')` y `trackError(...)`.
- `placesService.ts`: `countApiCall('mapbox_geocoding')` por cada búsqueda de dirección.
- `buildCheckoutBody.ts`: la atribución viaja con la reserva (`bookings.acquisition`, jsonb).

---

## 3. Variables de entorno

| Variable | Dónde | Efecto |
|---|---|---|
| `VITE_GA4_ID` (`G-XXXX`) | Front, **solo Production** | Sin ella no se carga GA4 |
| `VITE_META_PIXEL_ID` | Front, solo Production | Sin ella no se carga Meta |
| `VITE_ANALYTICS_ENDPOINT` | Front (opcional) | Ruta del endpoint propio. Por defecto `/api/track` **solo en producción**; en dev `null` = medición propia apagada |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** (Vercel) | El endpoint escribe en la BD. **Nunca** con prefijo `VITE_` |
| `ANALYTICS_SALT` | Solo servidor | Cadena aleatoria larga (`openssl rand -hex 32`), distinta por entorno. Se combina con la sal diaria de la BD. Cambiarla reinicia los únicos del día |

Sin las tres variables de servidor, el endpoint responde `204` y no guarda nada (falla en silencio).

El front lo lee con un esquema (`web/src/lib/env.ts`, zod). Fragmento relevante:

```ts
ga4Id: values.VITE_GA4_ID,
metaPixelId: values.VITE_META_PIXEL_ID,
analyticsEndpoint:
  values.VITE_ANALYTICS_ENDPOINT ?? (values.VITE_APP_ENV === 'production' ? '/api/track' : null),
```

---

## 4. Parte A — Medición propia sin cookies

### 4.1 Eventos (taxonomía cerrada)

```ts
export const TRACK_EVENTS = ['page_view', 'funnel', 'error', 'action', 'api_usage'] as const
export const FUNNEL_STEPS = ['form', 'quote', 'vehicle', 'details', 'payment', 'confirmation'] as const

export interface TrackPayload {
  event: TrackEvent
  path: string
  step?: FunnelStep      // obligatorio en 'funnel' y 'error'
  code?: string          // 'error': motivo · 'action': nombre · 'api_usage': nombre de la API
  value?: number         // entero 0..10000 (api_usage: nº de llamadas)
  lang?: string
  referrer?: string      // solo dominio
  utmSource?: string; utmMedium?: string; utmCampaign?: string
}
```

| Evento | Cuándo lo manda el navegador |
|---|---|
| `page_view` | En cada cambio de ruta (SPA). La **primera** de la visita añade `referrer` y UTM |
| `funnel` | Cada paso del embudo, **una vez por visitante y día cuenta como alcanzado** (se agrega con `count(distinct visitor)`) |
| `error` | Error en un paso (cotización rechazada, precio cambiado, pago denegado…) con `step` + `code` |
| `action` | Acción de interés (p. ej. `upsell_shown`, `upsell_accepted`) |
| `api_usage` | Lote de llamadas a APIs que se hacen desde el navegador (búsqueda de direcciones), enviado al ocultar la página |

Correspondencia embudo ↔ eventos de marketing (en `trackers.ts`): `trackFormStart` → `form`,
`view_item_list` → `quote`, `select_item` → `vehicle`, `begin_checkout` → `details`,
`add_payment_info` → `payment`, `purchase` → `confirmation`. Así **una sola llamada a `track()`**
alimenta a la vez el embudo propio (sin cookies) y a GA4/Meta (si hay consentimiento).

### 4.2 Cliente (`firstParty.ts`)

```ts
let enabled = true
export function setMeasurement(on: boolean) { enabled = on }   // lo fija applyConsent

function send(p) {
  const endpoint = env.analyticsEndpoint
  if (!endpoint || !enabled || typeof window === 'undefined') return
  const body = JSON.stringify({ path: window.location.pathname, ...p })
  try {
    if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) return
    void fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch { /* la medición nunca rompe la web */ }
}
```

- `sendBeacon` no bloquea la navegación ni el cierre de la pestaña; `fetch` con `keepalive` es el plan B.
- `fpPageView(path)` añade `lang: navigator.language`; solo la primera vista añade `referrer`
  (`document.referrer`) y las UTM de la atribución.
- `countApiCall(api)` acumula en un `Map` y manda **un evento `api_usage` por API** al
  `pagehide` / `visibilitychange → hidden`, para no generar un evento por pulsación de tecla.

### 4.3 Endpoint (`web/api/track.ts`, función serverless estándar `Request → Response`)

Flujo, en orden (cada fallo = `204` silencioso):

1. Faltan `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ANALYTICS_SALT` → `204`.
2. **Bot** (user-agent vacío o que casa con `/bot|crawl|spider|headless|lighthouse|curl|wget|python|…/i`) o
   petición que **no viene de la propia web** → `204`.
3. Cuerpo > 4 000 caracteres o JSON inválido → `204`.
4. `parseTrackPayload()` valida y limpia; `null` = descartar.
5. Pide la **sal del día a la BD** (RPC `analytics_salt`, cacheada en memoria de la instancia; solo se
   guarda la de hoy).
6. `visitor = visitorHash(`${saltBD}:${ANALYTICS_SALT}`, día, IP, user-agent)`.
7. Inserta la fila con `service_role` (REST de Supabase, `Prefer: return=minimal`, timeout 3 s).
8. Siempre `204`.

Detalles que importan:

```ts
// ¿La petición viene de la propia web? (corta el envenenamiento fácil desde otras webs)
export function isSameOrigin(get): boolean {
  const site = get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = get('origin'); const host = get('x-forwarded-host') ?? get('host')
  if (!origin || !host) return false           // curl/scripts sin cabeceras: fuera
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase() } catch { return false }
}

// Visitante anónimo del día: la sal del día es HMAC(secreto, día) y el hash lleva IP + navegador
export async function visitorHash(secret, day, ip, userAgent) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const salt = hex(await crypto.subtle.sign('HMAC', key, enc.encode(day)))
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}|${ip}|${userAgent}`))
  return hex(digest).slice(0, 24)
}
```

- **Día de negocio**: `new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(now)` →
  `YYYY-MM-DD`. La sal cambia a medianoche **de la zona del negocio**, no UTC.
- **IP**: `x-real-ip` (la fija el hosting) o la primera de `x-forwarded-for`.
- **Geolocalización**: cabeceras del hosting (`x-vercel-ip-country`, `-country-region`, `-city`;
  la ciudad llega codificada con `decodeURIComponent`). En otro hosting: Cloudflare
  (`cf-ipcountry`), Netlify, etc. País solo si casa `^[A-Z]{2}$`.
- **Dispositivo** desde el user-agent: `tablet` (`ipad|tablet|android` sin `mobile`) → `mobile`
  (`mobi|iphone|ipod|android`) → `desktop`.

### 4.4 Validación y normalización (`trackCore.ts`)

`parseTrackPayload(input, ownHost)` devuelve `null` si:

- el evento no está en la lista blanca;
- la ruta no empieza por `/`;
- la ruta es del **panel o de herramientas de dev** — regex insensible a mayúsculas
  `^/(en/)?(admin|_ds|_emails)(/|$)`. *(Lección aprendida: el router no distingue mayúsculas, así que
  `/ADMIN` también es el panel; sin `i` se colaba tráfico interno.)*;
- `funnel` o `error` sin `step` válido;
- `api_usage` sin `value` entero ≥ 1 (tope 200 por evento) o con una API que no esté en `BROWSER_APIS`.

Y limpia: recorta longitudes, `code` solo `[\w.:-]`, UTM en minúsculas, `referrer` → dominio.

**`normalizePath`** — imprescindible para no guardar datos personales en la ruta. La página de
confirmación es `/reservar/confirmacion/VTC-ABC123`: esa referencia enlazaría la visita con una persona.

```ts
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0]!.replace(/\/{2,}/g, '/')      // sin query ni hash
  const parts = clean.split('/').map((seg) => {
    if (/^vtc-[a-z0-9]{4,}$/i.test(seg)) return ':ref'                // referencia de reserva
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':id'  // UUID
    if (/\d{5,}/.test(seg) || /^[A-Za-z0-9_-]{24,}$/.test(seg)) return ':token'  // números/tokens largos
    return seg
  })
  const out = parts.join('/')
  return out.length > 1 ? out.replace(/\/$/, '') : '/'
}
```

**`referrerHost`**: solo el dominio sin `www`; devuelve `undefined` si es la propia web **o una pasarela**
(`stripe.com`, `stripe.network`, `paypal.com`, `supabase.co`): la vuelta de un 3DS, de PayPal o de un enlace
de acceso no es «una visita desde stripe.com».

### 4.5 Base de datos

Esquema (resumido; ver la migración para los `check`):

```sql
create table public.analytics_events (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  visitor      text not null check (char_length(visitor) between 8 and 64),
  event        text not null check (event in ('page_view','funnel','error','action','api_usage')),
  path text, step text, code text, value integer,
  country char(2), region text, city text,
  device text check (device in ('mobile','tablet','desktop')),
  lang text, referrer text, utm_source text, utm_medium text, utm_campaign text
  -- cada columna de texto con check (char_length(...) <= N)
);
create index on public.analytics_events (occurred_at);
create index on public.analytics_events (visitor, occurred_at);
alter table public.analytics_events enable row level security;   -- SIN políticas
grant all on public.analytics_events to service_role;            -- solo el backend

create table public.analytics_daily (          -- resumen: lo que queda tras borrar el bruto
  day date not null, metric text not null, dim text not null default '', value bigint not null,
  primary key (day, metric, dim)
);
```

**Sal diaria aleatoria que se destruye** (la pieza clave de privacidad):

```sql
create table private.analytics_salts (day date primary key, salt text not null);
revoke all on private.analytics_salts from public, anon, authenticated;

create function public.analytics_salt(p_day date) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if p_day < (now() at time zone 'Europe/Madrid')::date - 1 then
    raise exception 'Sal caducada' using errcode = 'check_violation';   -- no se regenera el pasado
  end if;
  insert into private.analytics_salts (day, salt)
  values (p_day, replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''))
  on conflict (day) do nothing;
  select s.salt into v from private.analytics_salts s where s.day = p_day;
  return v;
end; $$;
revoke execute on function public.analytics_salt(date) from public, anon, authenticated;
grant  execute on function public.analytics_salt(date) to service_role;
```

El cron nocturno hace `delete from private.analytics_salts where day < ayer` → a las 48 h la sal ya no existe.

**Tope por visitante** (inundación/envenenamiento): trigger `before insert` que **descarta en silencio**
(`return null`) si ese `visitor` ya tiene ≥ 500 eventos en 24 h.

**Resumen y limpieza** (`pg_cron`, `15 2 * * *` UTC = 03:15/04:15 en Madrid: «ayer» ya está completo):

```sql
create function private.analytics_nightly() returns void ... as $$
declare v_yesterday date := (now() at time zone private.tz())::date - 1;
begin
  perform private.analytics_rollup(v_yesterday);         -- idempotente: borra y reinserta el día
  perform private.analytics_rollup(v_yesterday - 1);     -- por si el cron falló algún día
  perform private.analytics_rollup(v_yesterday - 2);
  delete from public.analytics_events where occurred_at < now() - interval '90 days';
  delete from public.quote_log        where created_at  < now() - interval '400 days';
  delete from private.analytics_salts where day < v_yesterday;
end; $$;
select cron.schedule('analytics-nightly', '15 2 * * *', $$ select private.analytics_nightly(); $$);
```

`analytics_day_metrics(p_day)` calcula, con una sola consulta `union all`, las métricas de un día
(`visitors`, `pageviews`, `visits`, `funnel` por paso, `error`, `action`, `country`, `city`, `source`,
`device`, `lang`, `page`, `api`). Dos detalles:

- **Visitas (sesiones)**: una nueva visita cuando pasan > 30 min desde el evento anterior del mismo
  visitante (`lag(occurred_at) over (partition by visitor order by occurred_at)`).
- **Fuente**: `coalesce(nullif(utm_source,''), nullif(referrer,''), '(directo)')`.

`analytics_range(from, to)` usa el resumen guardado y, para los días sin resumen (hoy, o ayer antes del
cron), **calcula en vivo** desde los eventos: el panel nunca ve huecos.

**RPCs del panel** (`admin_analytics_traffic | demand | sales | after_sales | operations | costs`):
`security definer`, `set search_path = ''`, llaman a `private.require_staff()` (lanza `42501` si no eres
staff), validan el rango (máx. 400 días) y devuelven **`jsonb`** ya agregado. Se les revoca `EXECUTE` a
`public` y `anon`, y se concede a `authenticated` (la comprobación de rol va dentro de la función).

### 4.6 Registro anónimo del cotizador y uso de APIs (complementos)

- **`quote_log`**: cada petición al cotizador (atendida **o no**) guarda una fila **sin datos
  personales**: resultado, municipio, país, coordenadas **redondeadas a 2 decimales (~1 km)**,
  antelación, pasajeros, km, nº de opciones, precio mínimo. Da la «demanda no atendida» (por qué no se pudo
  cotizar, a dónde querían ir). Se escribe desde la edge function, sin bloquear la respuesta
  (`void admin.from('quote_log').insert(...)`), y el simulador del panel no cuenta.
- **Uso de APIs de pago**: lo que se llama desde el servidor se cuenta con la RPC `count_api_usage(api, n)`
  (`api_usage_daily`, suma por día); lo que se llama desde el navegador (geocodificación), con eventos
  `api_usage`. Sirve para vigilar costes frente al plan gratuito.

### 4.7 Panel (`/admin/analiticas`)

Bloques: Tráfico (visitantes, visitas, páginas vistas, serie diaria, países/ciudades/fuentes/dispositivos/
idiomas/páginas), **Embudo de reserva con abandono y errores**, Demanda (incluida la no atendida), Ventas y
canales, Postventa, Operación y Costes/APIs. Periodos: 7 días, 30 días, este mes, 12 semanas, este año.
Solo lo ven staff (gestor y admin). El panel **no cuenta como tráfico** (`adminShell` no manda `page_view`
y el servidor descarta `/admin`).

---

## 5. Parte B — Cookies, consentimiento y marketing

### 5.1 Modelo de consentimiento (`consentStore.ts`)

```ts
export interface Consent {
  analytics: boolean     // cookies de analítica (GA4)
  marketing: boolean     // cookies de publicidad (Meta, Google Ads) e identificadores de clic
  measurement: boolean   // medición propia sin cookies (interés legítimo, con oposición)
  decidedAt: string      // ISO
  version: number        // CONSENT_VERSION: súbela si cambian las finalidades → se vuelve a preguntar
}
export const CONSENT_MAX_DAYS = 365          // se renueva cada 12 meses

// ¿Se puede medir sin cookies? Sí, salvo oposición. Sin decisión aún, la señal GPC cuenta como oposición.
export const measurementAllowed = (c: Consent | null) =>
  c ? c.measurement !== false : !globalPrivacyControl()
```

- Se guarda en `localStorage` (clave `vtc.consent.v1`) dentro de `try/catch`: guardar la decisión es
  almacenamiento estrictamente necesario.
- **Decisión inválida** (otra versión, caducada, corrupta) = tratarla como «no hay decisión» → banner.
- **GPC**: `navigator.globalPrivacyControl === true`.

### 5.2 Banner (`CookieBanner.tsx`)

- Overlay **fijo abajo**: no empuja el contenido (cero CLS; DevelopmentBasics §6).
- Tres botones: **Configurar**, **Solo necesarias** (`analytics:false, marketing:false`), **Aceptar todas**.
  En los dos primeros, `measurement` conserva el valor del interruptor (por defecto activo salvo GPC):
  *rechazar cookies no apaga la medición sin cookies*.
- «Configurar» abre un `Modal` con 4 filas: Necesarias (fija y deshabilitada) · **Medición sin cookies** ·
  Analítica · Publicidad.
- **Prerenderizado/hidratación**: el HTML estático **no** lleva el banner (si no, parpadearía en quien ya
  decidió). Se renderiza solo cuando `useHydrated()` es `true` → `if (!bannerOpen || !hydrated) return null`.
- Hay un enlace «Preferencias de cookies» en el pie que llama a `reopen()`.

### 5.3 Carga de GA4 y Meta (`trackers.ts`)

Reglas: **solo producción**, **solo con consentimiento**, **después** de la decisión (nunca bloquean el
primer pintado), **Consent Mode v2 con todo denegado por defecto**.

```ts
const gaAllowed   = () => !!current && (current.analytics || current.marketing)
const metaAllowed = () => !!current && current.marketing

function ensureGtagStub() {            // se crea ANTES de cargar gtag.js
  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag() { window.dataLayer!.push(arguments) }   // gtag exige `arguments`
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
  })
}
function loadGa4(id) { ensureGtagStub(); gtag('js', new Date()); gtag('config', id, { anonymize_ip: true });
                       injectScript(`https://www.googletagmanager.com/gtag/js?id=${id}`) }
function loadMetaPixel(id) { /* stub fbq con cola → fbq('init', id); fbq('track','PageView'); inyecta fbevents.js */ }
```

`applyConsent(consent)` (se ejecuta al cargar y en cada cambio):

1. `setMeasurement(measurementAllowed(consent))` → enciende/apaga la medición propia.
2. `syncAttribution(consent)` (ver §6) y `setReplayConsent(!!consent?.analytics)` (Sentry Replay guarda un
   identificador en el navegador: solo con analítica).
3. Si no es producción o no hay decisión → fin.
4. **Retirada**: si GA estaba cargado y ya no hay analítica ni publicidad → `gtag('consent','update', todo 'denied')`.
   Si se quitó analítica → borra `_ga`, `_gid`. Si se quitó publicidad → borra `_gcl*`, `_fbp`, `_fbc` y
   `fbq('consent','revoke')`.
5. **Concesión**: con analítica o publicidad y `ga4Id` → `loadGa4` + `gtag('consent','update', {analytics_storage, ad_*: 'granted'|'denied'})`.
   Con publicidad y `metaPixelId` → `loadMetaPixel`.

Borrado de cookies (hay que probar varios dominios porque GA las pone en `.dominio.com`):

```ts
const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
for (const c of document.cookie.split(';')) {
  const name = c.split('=')[0]!.trim()
  if (!prefixes.some((p) => name.startsWith(p))) continue
  for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`
}
```

API pública: `track(evento, params)` (embudo + GA4 + Meta con su equivalente: `view_item_list`/`select_item` →
`ViewContent`, `begin_checkout` → `InitiateCheckout`, `add_payment_info` → `AddPaymentInfo`, `purchase` →
`Purchase`), `trackError(step, code)` (propio + evento `vtc_error` en GA), `trackAction(code)`,
`trackFormStart()`. En desarrollo `track()` solo hace `console.debug` (y el embudo propio solo si hay endpoint).

Nota GA4: en SPA, las vistas de página tras el primer `config` las recoge GA4 con **«Eventos de medición
mejorada → cambios de página según el historial del navegador»** activado en la propiedad (viene activo por
defecto). Si no, habría que mandar `gtag('event','page_view')` en cada cambio de ruta.

---

## 6. Atribución de marketing (`attribution.ts`)

Objetivo: guardar **de dónde vino el cliente** con cada reserva (`bookings.acquisition`, jsonb), p. ej. «esta
venta vino de la campaña X».

- `parseAttribution(url, referrer, now)`: lee `utm_source|medium|campaign|term|content`, `gclid`, `fbclid`
  (máx. 200 caracteres) y un `referrer` **externo** (se ignora si es la propia web). Si no hay nada → `null`
  (tráfico directo/interno). Modelo **«último clic no directo»**: una visita con parámetros o con referrer
  externo **sustituye** a la anterior; una directa no la borra.
- **Dónde vive depende del consentimiento** (porque guardarla 30 días en el dispositivo no es estrictamente
  necesario):
  - **Sin consentimiento** (analítica ni publicidad): solo **en memoria** durante la visita (se pierde al
    recargar) y **sin** `gclid`/`fbclid`.
  - **Con consentimiento**: `localStorage` 30 días (`ATTRIBUTION_TTL_DAYS`).
  - Los **identificadores de clic** (`gclid`, `fbclid`) solo se conservan con consentimiento de **publicidad**
    (`forConsent()` los elimina si no).
- `captureAttribution()` se llama al montar el layout; `syncAttribution(consent)` en cada cambio de decisión
  (guarda lo de esta visita o **borra** lo guardado si se retira el consentimiento); `getAttribution()` devuelve
  la vigente (no caducada) para enviarla con la reserva.

---

## 7. Cómo implementarlo en otro proyecto (orden recomendado)

1. **Núcleo puro** `trackCore.ts` con tests (§4.4): lista blanca de eventos, `parseTrackPayload`,
   `normalizePath`, `referrerHost`, `isBot`, `deviceFromUa`, `geoFromHeaders`, `isSameOrigin`, `visitorHash`,
   `eventRow`. Sin dependencias, importable desde servidor y navegador.
2. **BD**: tablas `analytics_events` (RLS activada **sin políticas**), `analytics_daily`, `analytics_salts` y
   RPC `analytics_salt`; trigger de tope; función de métricas del día, `rollup`, `range` y el cron nocturno.
3. **Endpoint** `/api/track` (§4.3). Variables solo de servidor. Comprueba que el hosting no reescribe
   `/api/*` a la SPA (aquí las reescrituras de `vercel.json` son una lista explícita de rutas, por eso no hay conflicto).
4. **Cliente propio** `firstParty.ts` y la llamada `fpPageView(pathname)` en el layout raíz (cada cambio de ruta,
   sin contar el panel).
5. **Consentimiento**: `consentStore.ts` + `ConsentProvider` + `CookieBanner` con los tres interruptores. Versión y
   caducidad. Soporte GPC. Banner solo tras hidratar si hay prerenderizado.
6. **Marketing**: `trackers.ts` (Consent Mode v2 por defecto denegado, carga diferida, retirada que borra cookies).
   Solo producción.
7. **Atribución**: `attribution.ts` y envío con la reserva/lead.
8. **Puntos de medición** del embudo y errores en las pantallas (§4.1).
9. **Panel**: RPCs `security definer` solo staff devolviendo `jsonb`, y la página que las pinta.
10. **Legal y textos**: política de cookies que describa **las dos capas** y su base jurídica, y texto del banner/panel
    (en este proyecto en `cookies.*` de `es.json`/`en.json`). Esto no es opcional.

### Adaptaciones según el stack

| Aquí | Si tu stack es otro |
|---|---|
| Vercel function (`Request→Response`) | Cualquier endpoint serverless/edge (Cloudflare Worker, Netlify, Express…): misma lógica |
| Cabeceras `x-vercel-ip-*` | `cf-ipcountry`/`cf-ipcity` (Cloudflare), `x-nf-geo` (Netlify), o una base GeoIP local |
| Supabase + `pg_cron` | Cualquier Postgres con un job programado; o un cron externo que llame a una función |
| Zona `Europe/Madrid` | La del negocio (afecta al «día» de la sal y a los resúmenes diarios) |
| React Router/SPA | En multipágina, `page_view` en cada carga; el resto igual |

---

## 8. Cómo se comprueba (tests que existen aquí)

- `trackCore.test.ts`: valida y limpia el evento; **`/ADMIN`, `//admin` y `/en/Admin` no cuentan**; la ruta no
  guarda la referencia de reserva ni IDs; `api_usage` solo de APIs del navegador y con tope; la propia web y la
  vuelta de la pasarela no son una fuente; solo peticiones de la propia web; bots, dispositivo, IP y
  geolocalización; **el visitante es igual el mismo día, distinto otro día y no contiene la IP**.
- `consent.test.ts`: caducidad a los 12 meses y nueva versión → se vuelve a preguntar; medición activa por defecto salvo oposición o GPC; la atribución sin consentimiento no se guarda ni lleva `gclid`, con analítica se guarda sin identificadores de clic y retirar el consentimiento la borra.
- `attribution.test.ts`: captura UTM, `gclid`, `fbclid` y referrer externo; ignora el tráfico directo y la navegación interna; recorta valores enormes; caduca a los 30 días.
- `trackers.test.ts`: al retirar el consentimiento, GA y Meta dejan de recibir eventos en el acto y se borran sus cookies.
- BD (PGlite, `supabase/tests/pglite/run.mjs`): ni `anon` ni un admin leen/escriben la tabla de eventos (`permission denied`); la sal es aleatoria, una por día, solo `service_role` la pide, no se regenera para días pasados y se borra; un visitante no puede pasar del tope diario (700 inserciones → se descartan); las RPC del panel exigen ser staff; los eventos de más de 90 días se limpian.

---

## 9. Errores que ya nos costaron y cómo se evitan

| Problema | Solución |
|---|---|
| El tráfico interno (admin) se colaba por `/ADMIN` | Regex con flag `i` y la comprobación en servidor, no solo en el cliente |
| La referencia de reserva en la URL enlazaba una visita con una persona | `normalizePath` sustituye referencias, UUID y números/tokens largos |
| La vuelta de Stripe/PayPal/3DS aparecía como «fuente de tráfico» | Lista `NOT_A_SOURCE` en `referrerHost` |
| Bots, Lighthouse y previews inflaban las visitas | `isBot` por user-agent (y UA vacío = bot) |
| Envenenamiento del endpoint desde otras webs | `isSameOrigin` (`Sec-Fetch-Site`/`Origin`) + tope de 500 eventos por visitante y 24 h |
| Tras retirar el consentimiento, GA/Meta seguían recibiendo eventos hasta recargar | `current` en memoria + `gtag('consent','update')` + `fbq('consent','revoke')` + borrado de cookies |
| El banner parpadeaba en el HTML prerenderizado | No se pinta hasta hidratar |
| Guardar la atribución 30 días sin consentimiento | Solo en memoria sin consentimiento; con consentimiento, 30 días |
| La clave de servicio no debe llegar nunca al navegador | Variables de servidor sin prefijo `VITE_`; la tabla no tiene RLS de lectura |

---

## 10. Privacidad: qué se guarda y qué no

**Se guarda** (por evento): visitante-hash del día, tipo de evento, ruta normalizada, paso/código, país,
región y ciudad (de la geolocalización por IP del hosting), dispositivo (móvil/tableta/escritorio), idioma del
navegador, dominio de origen y UTM/campaña de la primera vista.

**No se guarda**: la IP, el user-agent completo, cookies ni identificadores persistentes, URL con query, referencias
de reserva, nombres, emails ni teléfonos. En el panel solo se ven **agregados**.

**Retención**: eventos en bruto 90 días → resumen diario agregado (sin visitante) indefinido; `quote_log` 400
días; sales de visitante 48 h.

> Nota legal: este diseño sigue el criterio español (LSSI art. 22.2 + RGPD 6.1.f/21). Es una decisión de
> producto/jurídica de este cliente; antes de copiarlo a otro país o sector, revísalo con quien corresponda.
