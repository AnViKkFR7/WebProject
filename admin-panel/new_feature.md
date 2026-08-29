# Analítica propia por empresa — panel de admin

Especificación técnica para sustituir/complementar GTM+GA4 por un sistema de
analítica de tráfico propio, alojado en la misma infraestructura que ya se usa
(Supabase multi-tenant + webs de empresa en Vercel), visible como una pestaña
nueva del panel de admin (moira ordo), replicable a cualquier empresa sin
tocar código ni base de datos.

**Alcance**: visitantes únicos/día, páginas vistas por ruta, país/ciudad del
visitante, tipo de dispositivo (móvil/PC/tablet), y **eventos de clic
configurables por la propia empresa** — cualquier botón o llamada a la acción
de su web (abrir contacto, enviar formulario, clic en WhatsApp, clic en
"Reservar", etc.), dados de alta desde el admin, sin límite de cuántos.
No es un sustituto de GA4 para marketing avanzado (embudos, atribución de
campañas, audiencias) — es tráfico + conversión básica por empresa.

**Por qué no GTM/GA4 para esto**: evita el aviso de cookies por completo (ver
`## Privacidad y base legal` más abajo), la geolocalización sale gratis vía
las cabeceras de Vercel en la web de cada empresa, y se construye una vez y se
reutiliza en el panel de admin de todas las empresas del multi-tenant — igual
que ya ocurre con `items` y `attribute_definitions` (ver `PROJECT_CONTEXT.md`
§1: "modelo de datos genérico [...] no se deben crear tablas específicas").

**Pieza clave que pides y que la v1 de este documento no cubría**: los tipos
de evento de clic (`event_type` en `analytics_events`) no pueden ser un enum
fijo en el código — cada empresa debe poder crear los suyos desde el admin
(botón "Nuevo evento") igual que ya crea sus propios `item_type` y
`attribute_definitions`. Ver §2 y §4 revisadas más abajo.

---

## 1. Arquitectura

```
Panel de admin (moira ordo, React/Vite — ESTE repo)
  │  pestaña "Analítica": la empresa da de alta sus propios eventos
  │  (botón "Nuevo evento" → analytics_event_definitions), igual que ya
  │  da de alta sus item_type/attribute_definitions en "Mis datos"
  ▼
Supabase (tabla analytics_event_definitions, RLS por company_id)
  ▲  el endpoint de ingesta valida cada evento entrante contra esta tabla
  │
Web de la empresa (React/Vite, proyecto Vercel APARTE, ej. Arquelia —
  NO vive en este repo)
  │  snippet npm/copiado: <script data-track-event="whatsapp_click"> en
  │  cualquier botón/CTA → una única función delegada captura el click,
  │  nada de cablear una función nueva por cada botón (ver §4)
  ▼
POST /api/track   (Vercel Edge/Serverless Function, en el propio proyecto
                    Vercel de la web de empresa — ver §6 por qué ahí y no
                    centralizado en Supabase Edge Functions)
  │  lee geo de la petición (gratis en Vercel: cabeceras x-vercel-ip-*)
  │  parsea user-agent → device
  │  valida company_id + event_key contra analytics_event_definitions
  │  inserta con la service role key (nunca expuesta al cliente)
  ▼
Supabase (tabla analytics_events, filtrada por company_id)
  │
  │  job de agregación diaria (pg_cron en Supabase, ver §5)
  ▼
Tabla de rollups (analytics_daily) — lo que de verdad lee el dashboard
  ▲
  │  SELECT con RLS por company_id, usando los mismos helpers que ya
  │  existen en DB_SCHEMA.sql: is_company_member(), has_company_role(),
  │  is_platform_admin() — no se inventa un mecanismo de permisos nuevo
  │
Panel de admin → pestaña "Analítica" → gráficas
```

Tres piezas por cada web de empresa nueva, todas triviales y sin tocar base
de datos ni el panel de admin: 1) copiar el snippet de instrumentación
(§4), 2) copiar la función `/api/track` (§3, código idéntico siempre),
3) que la empresa dé de alta sus eventos desde el admin y añada
`data-track-event="..."` a los botones que quiera medir. La tabla, el
rollup, la agregación y el dashboard son *una sola vez*, compartidos por
todas las empresas del multi-tenant — igual que `items`/`attribute_definitions`.

---

## 2. Esquema de base de datos (Supabase / Postgres)

Sigue el mismo patrón que `items` + `attribute_definitions` (`DB_SCHEMA.sql`):
una tabla de **definiciones** que la empresa gestiona desde el admin (qué
eventos existen), y una tabla de **hechos** que sólo escribe el backend. Nada
de un enum fijo en código — así se cumple "se deben de poder crear tantas
[llamadas a la acción] como se quieran" sin tocar ni el endpoint ni el schema.

```sql
-- 0) DEFINICIONES DE EVENTO — lo que la empresa da de alta desde el admin.
-- 'page_view' NUNCA se guarda aquí: es implícito, se dispara solo en cada
-- cambio de ruta y siempre está permitido. Esta tabla es sólo para los
-- eventos de clic/CTA que cada empresa quiere medir (cuantos quiera).
create table public.analytics_event_definitions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  key            text not null,       -- identificador estable, ej. "whatsapp_click"
                                       -- usado en data-track-event="key" (ver §4)
  label          text not null,       -- nombre legible en el dashboard: "Clic en WhatsApp"
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  last_edited_by uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, key)
);

alter table public.analytics_event_definitions enable row level security;

-- Mismos helpers que el resto del schema (is_platform_admin, has_company_role,
-- is_company_member ya existen en DB_SCHEMA.sql) — nada de tabla "profiles",
-- que no existe en este proyecto.
create policy "analytics_event_definitions_select_tenant"
  on public.analytics_event_definitions for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));

create policy "analytics_event_definitions_write_tenant"
  on public.analytics_event_definitions for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, array['editor']))
  with check (public.is_platform_admin() or public.has_company_role(company_id, array['editor']));

drop trigger if exists trg_analytics_event_definitions_audit on public.analytics_event_definitions;
create trigger trg_analytics_event_definitions_audit
  before insert or update on public.analytics_event_definitions
  for each row execute function public.set_audit_fields();

drop trigger if exists trg_analytics_event_definitions_updated on public.analytics_event_definitions;
create trigger trg_analytics_event_definitions_updated
  before update on public.analytics_event_definitions
  for each row execute function public.set_updated_at();

-- 1) EVENTOS EN CRUDO. Se purgan a los N días (ver §5) — el dashboard lee
-- de analytics_daily, no de aquí directamente, salvo para depuración puntual.
create table public.analytics_events (
  id            bigint generated always as identity primary key,
  company_id    uuid not null references public.companies(id) on delete cascade,
  event_type    text not null check (event_type in ('page_view', 'cta_click')),
  event_key     text,                 -- null para page_view; para cta_click,
                                       -- debe existir en analytics_event_definitions
                                       -- (el endpoint de ingesta lo valida, §3)
  path          text,                 -- ruta de la página (page_view) o
                                       -- dónde ocurrió el clic (cta_click)
  session_id    text not null,        -- ver §4: NO es un ID persistente de usuario
  device        text check (device in ('mobile', 'desktop', 'tablet')),
  country       text,                 -- ISO 3166-1 alpha-2, ej. "ES"
  region        text,                 -- ej. "Catalonia" (lo que dé Vercel)
  city          text,
  created_at    timestamptz not null default now()
);

create index analytics_events_company_day_idx
  on public.analytics_events (company_id, created_at desc);

-- Row Level Security: cada empresa sólo lee lo suyo.
alter table public.analytics_events enable row level security;

-- Sólo el service role (el endpoint de ingesta, fuera de RLS) inserta — el
-- visitante anónimo nunca escribe directo a Supabase, así que no hace falta
-- política de insert para "anon" ni "authenticated".
create policy "analytics_events_select_tenant"
  on public.analytics_events for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));


-- 2) ROLLUP DIARIO: lo que realmente consulta el dashboard. Evita que las
-- gráficas tengan que agregar miles de filas en crudo en cada carga, y es lo
-- que se conserva a largo plazo aunque se purguen los eventos crudos.
create table public.analytics_daily (
  company_id      uuid not null references public.companies(id) on delete cascade,
  day             date not null,
  unique_visitors integer not null default 0,
  page_views      integer not null default 0,
  by_path         jsonb not null default '{}',   -- { "/servicios": 12, "/": 84, ... }
  by_device       jsonb not null default '{}',   -- { "mobile": 60, "desktop": 40 }
  by_country      jsonb not null default '{}',   -- { "ES": 90, "FR": 4, ... }
  by_event        jsonb not null default '{}',   -- { "whatsapp_click": 12, "form_submit": 4, ... }
                                                  -- clave = analytics_event_definitions.key,
                                                  -- crece sola según lo que la empresa dé de alta
  primary key (company_id, day)
);

alter table public.analytics_daily enable row level security;
create policy "analytics_daily_select_tenant"
  on public.analytics_daily for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));
```

`session_id`: no es un identificador de usuario ni se persiste más allá de la
sesión del navegador (nada de cookies — ver §4). Sirve únicamente para poder
contar "visitantes únicos" como `count(distinct session_id)` en vez de contar
cada `page_view` como una visita distinta.

**Formulario de contacto como caso particular, no especial**: en vez de las
columnas fijas `form_opens`/`form_submits` de la v1 de este documento, cada
empresa simplemente da de alta dos eventos propios — `form_open` y
`form_submit` — igual que daría de alta `whatsapp_click`. Se puede sembrar
esos dos por defecto al crear la empresa (ver §9, Fase 1) para no dejar el
CTA-estrella (el formulario de contacto) sin medir el primer día, pero no son
un caso especial en el schema ni en el endpoint.

---

## 3. Endpoint de ingesta

Una función serverless/edge en Vercel (o Supabase Edge Function, cualquiera de
las dos vale — Vercel es más simple si el resto del proyecto ya vive ahí).

```ts
// api/track.ts (Vercel Serverless Function, Node runtime — necesario para
// createClient con la service role key con garantías)
import { createClient } from '@supabase/supabase-js'

// Sólo en el servidor. NUNCA en una variable VITE_*/NEXT_PUBLIC_* — si
// lleva ese prefijo, Vite mete la clave en el bundle del cliente.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_EVENT_TYPES = new Set(['page_view', 'cta_click'])

// Caché en memoria por invocación fría (dura mientras la función esté
// "caliente" en Vercel) para no consultar analytics_event_definitions en
// cada clic — se refresca sola al cabo de unos minutos.
let definitionsCache: { keys: Set<string>; expiresAt: number } | null = null

async function activeEventKeys(companyId: string): Promise<Set<string>> {
  if (definitionsCache && definitionsCache.expiresAt > Date.now()) {
    return definitionsCache.keys
  }
  const { data } = await supabase
    .from('analytics_event_definitions')
    .select('key')
    .eq('company_id', companyId)
    .eq('is_active', true)
  const keys = new Set((data ?? []).map((d) => d.key))
  definitionsCache = { keys, expiresAt: Date.now() + 5 * 60 * 1000 }
  return keys
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { company_id, event_type, event_key, path, session_id } = await req.json()
  if (!company_id || !ALLOWED_EVENT_TYPES.has(event_type) || !session_id) {
    return new Response('Bad request', { status: 400 })
  }

  // Un clic con un event_key que la empresa no ha dado de alta (o que ha
  // desactivado) se descarta en silencio — así un botón mal etiquetado, un
  // ataque, o un evento borrado no ensucia analytics_events con basura.
  if (event_type === 'cta_click') {
    if (!event_key) return new Response('Bad request', { status: 400 })
    const keys = await activeEventKeys(company_id)
    if (!keys.has(event_key)) return new Response(null, { status: 204 })
  }

  // Gratis en Vercel: geo ya resuelto por la CDN, sin llamar a ningún
  // servicio externo de geolocalización.
  const country = req.headers.get('x-vercel-ip-country') ?? null
  const region = req.headers.get('x-vercel-ip-country-region') ?? null
  const city = req.headers.get('x-vercel-ip-city') ?? null

  const ua = req.headers.get('user-agent') ?? ''
  const device = /mobile/i.test(ua) ? 'mobile' : /tablet|ipad/i.test(ua) ? 'tablet' : 'desktop'

  const { error } = await supabase.from('analytics_events').insert({
    company_id,
    event_type,
    event_key: event_type === 'cta_click' ? event_key : null,
    path,
    session_id,
    device,
    country,
    region,
    city,
  })

  if (error) return new Response('Error', { status: 500 })
  return new Response(null, { status: 204 })
}
```

**Por qué en el proyecto Vercel de cada empresa y no como Supabase Edge
Function centralizada** (el resto de este repo usa Edge Functions Deno en
`supabase/functions/*`, ver `ADMIN_SETUP.md`): la geolocalización gratuita
(`x-vercel-ip-*`) sólo la resuelve la CDN de Vercel para tráfico que entra
por Vercel. Un endpoint centralizado en Supabase perdería ese dato gratis y
habría que pagar un servicio externo de geo-IP. El *código* de esta función
es idéntico para todas las empresas — se publica como paquete interno
reutilizable (o se copia, ver §9 Fase 6) y cada empresa lo despliega en su
propio proyecto de Vercel, apuntando siempre al mismo Supabase con su
`company_id` propio. Nunca hay CORS que gestionar porque el endpoint vive en
el mismo dominio que la web que lo llama.

**Rate limiting** (ver también §8): usar el rate limiting nativo de Vercel
(`@vercel/firewall` o límites del plan) por IP sobre `/api/track`, en vez de
construir uno a medida en la función — evita abrir una tabla nueva sólo para
contar peticiones por minuto.

---

## 4. Instrumentación del lado cliente

```ts
// lib/analytics.ts — en cada web de empresa (paquete/snippet reutilizable,
// idéntico salvo la env var de company_id)
const ENDPOINT = '/api/track'
const COMPANY_ID = import.meta.env.VITE_COMPANY_ID // una por proyecto Vercel

// Un id aleatorio por PESTAÑA/SESIÓN, en memoria — no en localStorage ni en
// cookie. Se pierde al cerrar la pestaña: es justo lo que se quiere, porque
// así no hace falta pedir consentimiento (no se accede a ningún
// almacenamiento del dispositivo, sólo se manda con cada petición).
const sessionId = crypto.randomUUID()

function send(event_type: 'page_view' | 'cta_click', extra?: { path?: string; event_key?: string }) {
  const body = JSON.stringify({ company_id: COMPANY_ID, event_type, session_id: sessionId, ...extra })
  // sendBeacon no bloquea la navegación ni se pierde si el usuario cambia
  // de página justo después del clic (a diferencia de un fetch normal).
  navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
}

export const trackPageview = (path: string) => send('page_view', { path })

// Auto-instrumentación: UN solo listener delegado en toda la app, capturado
// una vez al arrancar. Cualquier botón/link/CTA nuevo se mide con solo
// añadirle un atributo HTML — sin importar esta librería, sin escribir una
// función nueva por evento, sin tocar código cada vez que la empresa da de
// alta un evento distinto desde el admin. Esto es lo que hace que sea
// "fácilmente reproducible en cualquier web": el desarrollador de la web de
// empresa pone `data-track-event="whatsapp_click"` en el botón que quiera
// medir, y ya está — el key tiene que coincidir con lo dado de alta en el
// admin (§2), si no coincide el backend lo descarta en silencio (§3).
export function initAutoTracking() {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element)?.closest?.('[data-track-event]')
    const key = el?.getAttribute('data-track-event')
    if (key) send('cta_click', { path: window.location.pathname, event_key: key })
  })
}
```

```html
<!-- En cualquier botón/link de la web de empresa, sin JS adicional -->
<button data-track-event="whatsapp_click">Escríbenos por WhatsApp</button>
<button data-track-event="form_submit" type="submit">Enviar</button>
```

Cablear `trackPageview` en el mismo sitio donde ya vive la navegación de
react-router (cambio de ruta), e `initAutoTracking()` una sola vez al
arrancar la app (`main.tsx`/`App.tsx`). El formulario de contacto no
necesita código especial: sus botones "Abrir formulario" y "Enviar" llevan
`data-track-event="form_open"` / `data-track-event="form_submit"` como
cualquier otro CTA — ver nota en §2 sobre sembrar esos dos eventos por
defecto.

---

## 5. Agregación y retención

`pg_cron` está disponible en Supabase (extensión activable desde el
Dashboard, plan gratuito incluido) — se usa eso en vez de una Vercel Cron
Function, porque así el job vive junto a los datos y no depende de que
ningún proyecto Vercel de empresa esté desplegado o activo.

**No se agrega solo una vez al día.** El rollup (`analytics_daily`) se
recalcula del día en curso a las 10:00, 12:00, 14:00, 16:00 y 18:00 (hora de
Madrid, vía `pg_cron` en UTC), así que el dashboard se va actualizando
durante el día en vez de aparecer de golpe al día siguiente. A las 03:00 se
hace el cierre definitivo del día anterior (ya completo) y la purga de
eventos en crudo de más de 35 días. Además, desde el propio panel de admin
hay un botón **"Agregar ahora"** (pestaña Analítica) que fuerza el
recálculo del día de hoy al instante para esa empresa, vía la función RPC
`trigger_company_analytics_aggregation(company_id)` — pensado sobre todo
para verificar que la integración de una web nueva funciona sin tener que
esperar al siguiente pase programado.

La función de agregación (`aggregate_analytics_rollup`, compartida entre el
cron y el botón "Agregar ahora"), la de purga, la de autorización del RPC
manual, y los `cron.schedule(...)` con los horarios exactos, viven en
`ANALYTICS_AGGREGATION.sql` (raíz del repo) — es el script real que se
ejecuta en Supabase, no se duplica aquí para no arriesgarse a que las dos
copias diverjan. Resumen de qué hace:

1. `aggregate_analytics_rollup(target_day, target_company_id opcional)`:
   agrega los eventos de `target_day` en una fila de `analytics_daily` por
   `company_id` (`count(distinct session_id)` para visitantes únicos,
   `count(*) filter (where event_type = 'page_view')` para páginas vistas),
   agrupando también por `path`/`device`/`country`/`event_key`. Con
   `target_company_id`, agrega solo esa empresa (uso del botón manual); sin
   él, agrega todas las empresas con eventos ese día (uso del cron).
2. `purge_old_analytics_events()`: borra de `analytics_events` los eventos
   con más de 35 días. Separada de la agregación para que solo corra una
   vez al día, no en cada pasada intradía. `analytics_daily` se conserva
   para siempre.
3. `trigger_company_analytics_aggregation(company_id)`: wrapper con
   comprobación de rol (`is_platform_admin()` o `has_company_role(...,
   ['editor'])`), expuesto vía RPC a `authenticated` — es lo que llama el
   botón "Agregar ahora" del admin, siempre acotado al día de hoy y a la
   empresa del que lo pulsa, nunca a fechas pasadas arbitrarias.

---

## 6. Panel de admin — pestaña, consultas y gráficas

Nueva pestaña **"Analítica"** en `admin-panel`, siguiendo exactamente el
patrón ya usado por `/items` y `/my-data` (ver §9 y `roadmap.md` para el
detalle archivo a archivo): entrada en `navItems` de `Sidebar.jsx`, ruta en
`App.jsx`, página en `src/pages/Analytics.jsx`, servicio en
`src/services/analyticsService.js`, scope por `selectedCompany.id` desde
`CompanyContext`, textos en `locales/en.js`/`es.js`, mobile-first con las
mismas variables CSS (`--primary-color`, `--bg-card`, `--text-secondary`,
`data-theme`) que ya usa `Dashboard.jsx`.

**Sin librería de gráficas todavía en el repo** (se comprobó `package.json`
del admin panel) — hace falta añadir una. Recomendado: **Recharts**
(compatible con React 19, responsive por defecto, curva de aprendizaje baja,
es la opción más habitual para dashboards React sencillos) en vez de
D3/Chart.js, que piden más código para lo mismo.

Con `analytics_daily` ya agregada, el dashboard es barato: una query por
rango de fechas, sin tocar la tabla en crudo.

```ts
const { data } = await supabase
  .from('analytics_daily')
  .select('*')
  .eq('company_id', companyId)
  .gte('day', startDate)
  .lte('day', endDate)
  .order('day')
```

Gráficas sugeridas (con esa única query ya alcanza para todas):
- Línea temporal: visitantes únicos y páginas vistas por día.
- Barras: páginas más visitadas (`by_path` sumado en el rango).
- Tarta o barras: dispositivo (`by_device`) y país (`by_country`).
- **Tabla/barras de eventos**: una fila por cada `key` presente en `by_event`
  sumado en el rango, con su `label` (join en memoria contra
  `analytics_event_definitions`) — crece sola según lo que la empresa haya
  dado de alta, sin código nuevo por evento.
- Tasa de conversión del formulario, si la empresa tiene los eventos por
  defecto `form_open`/`form_submit`: `sum(by_event.form_submit) /
  sum(by_event.form_open)`.

**Gestión de eventos desde la propia pestaña**: un botón "Nuevo evento"
(modal `CreateEventDefinitionModal.jsx`, mismo patrón que
`CreateAttributeModal.jsx`) donde la empresa introduce `key` (se puede
autogenerar en `snake_case` a partir del `label`) y `label`, y una lista de
sus eventos con toggle activo/inactivo — así el editor de cada empresa se
autogestiona sin pedir nada al equipo de desarrollo.

---

## 7. Privacidad y base legal

- **No se accede a ningún almacenamiento del dispositivo del visitante**
  (nada de cookies, nada de localStorage para esto) → no aplica el deber de
  consentimiento previo del art. 22.2 LSSI-CE/ePrivacy, que es específicamente
  sobre eso. **No hace falta el aviso de cookies para esta parte.**
- Sí se procesan datos personales en sentido amplio (la IP, aunque sea sólo
  para resolver el país/ciudad) → sigue aplicando el RGPD en general. Base
  legal razonable: interés legítimo del responsable (estadísticas de uso del
  propio sitio, sin fines publicitarios ni cesión a terceros) — la misma base
  que llevan usando los logs de acceso de cualquier servidor desde siempre.
- **No guardar la IP en crudo**: sólo el país/región/ciudad ya resueltos (que
  es justo lo que da Vercel en la cabecera, sin pasar por el endpoint la IP
  completa). Así se minimiza el dato desde el origen.
- Actualizar la política de privacidad (no la de cookies) para mencionar este
  tratamiento: qué se recoge, con qué fin, cuánto se conserva.
- El `session_id` no identifica a la persona entre visitas ni se cruza con
  ningún otro dato (nombre, email del formulario, etc.) — evitar esa tentación
  a futuro sería importante para que este argumento legal se mantenga en pie.

---

## 8. Seguridad

- La `SUPABASE_SERVICE_ROLE_KEY` sólo existe como variable de entorno en el
  servidor (la función `/api/track`), nunca con prefijo `VITE_`.
- Validar `company_id` contra la tabla `companies` en el propio endpoint (que
  exista), para que no se pueda inyectar tráfico falso a una empresa que no
  sea la que corresponde a ese despliegue.
- Validar `event_key` contra `analytics_event_definitions` con
  `is_active = true` y ese mismo `company_id` (§3) — evita que un clic con un
  `event_key` inventado o desactivado se cuele en `analytics_events`, y evita
  que la web de una empresa escriba eventos "a nombre de" otra aunque falsee
  el `company_id`, porque el join exige que la definición pertenezca a ese
  `company_id` exacto.
- Rate-limiting en el endpoint (por IP, vía el firewall/límites nativos de
  Vercel — ver §3) para evitar que alguien lo use para inflar/contaminar las
  estadísticas o como vector de abuso barato.
- RLS en Supabase (helpers `is_platform_admin()` / `is_company_member()` /
  `has_company_role()` ya existentes en `DB_SCHEMA.sql`) para que cada
  usuario del panel de admin sólo pueda leer `analytics_events`/
  `analytics_daily`, y sólo pueda escribir `analytics_event_definitions`
  (nunca los datos en crudo), de su propia empresa.

---

## 9. Fases de desarrollo (estimación orientativa)

Detalle archivo a archivo en `roadmap.md`, junto a este documento.

| Fase | Contenido | Estimación |
|---|---|---|
| 1 | Esquema completo en Supabase (`analytics_event_definitions`, `analytics_events`, `analytics_daily`) + RLS + triggers de auditoría | 0,5–1 día |
| 2 | Función de agregación `pg_cron` + purga de eventos crudos | 0,5 día |
| 3 | Pestaña "Analítica" en el admin panel (ruta, nav, servicio, gráficas con Recharts, gestión de eventos) | 1,5–2 días |
| 4 | Snippet de instrumentación cliente + endpoint `/api/track` reutilizable, documentado como paquete interno | 1 día |
| 5 | Integrar el snippet en la primera web de empresa real, dar de alta sus eventos, verificar de punta a punta | 0,5 día |
| 6 | Repetir la Fase 5 en el resto de webs de empresas del multi-tenant | ~0,25 día por web adicional |

Total orientativo para la primera empresa funcionando de punta a punta:
**4–5 días**. Cada empresa nueva después de la primera es mucho más barata
(sólo la Fase 5, y sin tocar código: dar de alta sus eventos es un
formulario en el admin).

---

## 10. Decisiones ya resueltas (v1 las dejaba pendientes)

- **Stack del admin panel**: React 19 + Vite 7 + `react-router-dom` v7, sin
  framework de componentes, CSS a mano con variables de tema
  (`admin-panel/src/App.css`), i18n propio (`useLanguage()`/`locales/`).
  El backend de ingesta vive en el proyecto Vercel de cada web de empresa,
  no en este repo (§1, §3).
- **Librería de gráficas**: ninguna presente todavía; se añade Recharts
  (§6) sólo para esta pestaña, sin reemplazar nada existente.
- **`pg_cron`**: disponible en Supabase como extensión activable desde el
  Dashboard (plan gratuito incluido); se usa para la agregación diaria en
  vez de una Vercel Cron Function (§5).