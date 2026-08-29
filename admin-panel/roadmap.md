# Roadmap — Analítica propia por empresa

Implementación de `new_feature.md`. Sigue el patrón ya establecido en este
repo para features de este tipo (`items` + `attribute_definitions`, ver
`ITEMS_IMPLEMENTATION.md` como referencia de forma): schema primero, luego
edge/servicios, luego UI del admin, y solo al final la integración en la
web pública de cada empresa. Mobile-first en toda la UI nueva, con soporte
claro/oscuro e i18n (es/en) desde el primer commit, igual que el resto del
panel.

---

## Fase 0 — Prerrequisito: activar `pg_cron`

En el Dashboard de Supabase → Database → Extensions, activar `pg_cron`
(gratis, incluido en el plan actual). Sin esto la Fase 2 no se puede
desplegar. Verificar con:

```sql
select * from pg_extension where extname = 'pg_cron';
```

---

## Fase 1 — Esquema en Supabase

**Archivo nuevo:** `ANALYTICS_SCHEMA.sql` (raíz del repo, mismo criterio que
`DB_SCHEMA.sql` y `user_filter_preferences_schema.sql`: un script que se
pega en el SQL Editor de Supabase).

Contenido: las tres tablas de `new_feature.md` §2
(`analytics_event_definitions`, `analytics_events`, `analytics_daily`) +
RLS + triggers de auditoría (`set_audit_fields`, `set_updated_at`, ya
existen como funciones — no se reescriben, solo se referencian).

Checklist:
- [ ] `analytics_event_definitions` con `unique (company_id, key)`
- [ ] `analytics_events` con índice `(company_id, created_at desc)`
- [ ] `analytics_daily` con PK compuesta `(company_id, day)`
- [ ] RLS activada en las tres tablas
- [ ] Políticas select con `is_platform_admin()` / `is_company_member()`
- [ ] Política write en `analytics_event_definitions` con
      `has_company_role(company_id, array['editor'])`
- [ ] **Sin política de insert/update en `analytics_events` ni
      `analytics_daily`** para `authenticated`/`anon` — solo el service role
      (fuera de RLS) escribe ahí, vía el endpoint de ingesta y el job de
      agregación
- [ ] Triggers de auditoría + `updated_at` en `analytics_event_definitions`
- [ ] Seed opcional: al crear una empresa nueva (dentro de la función
      `crear-empresa` existente, `supabase/functions/crear-empresa/index.ts`),
      insertar automáticamente dos filas en `analytics_event_definitions`:
      `form_open` / `form_submit`, para que el CTA principal (contacto) ya
      tenga eventos dados de alta el día 1 sin que el editor tenga que
      pensarlo. Es opcional — no rompe nada si se hace luego a mano.

Probar con `select` manual desde el SQL Editor logueado como usuario de
prueba, confirmando que un editor de la empresa A no ve filas de la empresa B.

---

## Fase 2 — Agregación (varias veces al día) + agregación manual

**Archivo:** `ANALYTICS_AGGREGATION.sql` — tres funciones y tres cron jobs:
- `aggregate_analytics_rollup(target_day, target_company_id opcional)`:
  la agregación en sí, compartida entre el cron (todas las empresas) y el
  RPC manual (una empresa)
- `purge_old_analytics_events()`: purga de eventos > 35 días, separada para
  que solo corra una vez al día
- `trigger_company_analytics_aggregation(company_id)`: wrapper con
  comprobación de rol, expuesto vía RPC — es lo que llama el botón
  "Agregar ahora" del admin (Fase 3)

**No es solo una vez al día**: el rollup del día en curso se recalcula a
las 10:00, 12:00, 14:00, 16:00 y 18:00 (hora de Madrid), más el cierre
definitivo del día anterior + purga a las 03:00. Motivo: con una sola
pasada de madrugada, quien acabe de integrar una web nueva no ve ningún
dato hasta el día siguiente, lo cual es mala experiencia para verificar que
la integración funciona — de ahí también el botón manual.

Checklist:
- [ ] `aggregate_analytics_rollup` creada y probada a mano:
      `select public.aggregate_analytics_rollup(current_date);` con datos
      de prueba insertados directamente en `analytics_events`
- [ ] `purge_old_analytics_events` creada y probada
- [ ] `trigger_company_analytics_aggregation` creada, con `grant execute ...
      to authenticated`, y probada desde el SQL Editor simulando un usuario
      sin rol de editor en esa empresa (debe fallar con "not authorized")
- [ ] Los tres cron jobs (`aggregate-analytics-daily`,
      `aggregate-analytics-intraday`, `purge-analytics-events`) registrados
      — confirmar en `cron.job_run_details` que corren sin error
- [ ] Nota de huso horario: `pg_cron` programa en UTC; las horas del script
      están calculadas para CET (invierno). En CEST (verano) las pasadas
      caen una hora antes de lo esperado en hora de Madrid — no es grave
      (siguen siendo 5 pasadas repartidas por el día), pero si molesta hay
      que reajustar los números de hora dos veces al año

---

## Fase 3 — Pestaña "Analítica" en el admin panel

Todo dentro de `admin-panel/`, siguiendo el mismo árbol que `/items` y
`/my-data`.

### 3.1 Dependencia nueva

```bash
cd admin-panel
npm install recharts
```

### 3.2 Servicio

**Archivo nuevo:** `admin-panel/src/services/analyticsService.js`
(mismo patrón que `attributeDefinitionService.js` / `itemService.js`: cada
función recibe `companyId` explícito y llama a `supabase.from(...)`).

Funciones:
- `getDailyAnalytics(companyId, startDate, endDate)` → query de
  `new_feature.md` §6
- `getEventDefinitions(companyId)` → `select * from analytics_event_definitions where company_id = ...`
- `createEventDefinition(companyId, { key, label })`
- `updateEventDefinition(id, { label, is_active })`
- `deleteEventDefinition(id)` (o preferible: solo `is_active = false`, para
  no perder histórico en `by_event` de días pasados que referencian esa key)
- `aggregateNow(companyId)` → `supabase.rpc('trigger_company_analytics_aggregation', { target_company_id: companyId })`,
  botón "Agregar ahora" (ver Fase 2)

### 3.3 Página

**Archivo nuevo:** `admin-panel/src/pages/Analytics.jsx`

Estructura (mobile-first: todo en columna única por defecto, grid solo desde
tablet/desktop, igual que `Dashboard.jsx` y `Items.jsx`):
1. Selector de rango de fechas (reutilizar `DatePicker.jsx` si aplica, o el
   mismo patrón de filtros que ya usa `Items.jsx`) + botón "Agregar ahora"
   junto a los presets, visible solo para editor/admin de esa empresa —
   fuerza el recálculo de hoy sin esperar al siguiente pase del cron,
   pensado para verificar una integración recién hecha
2. Tarjetas resumen (visitantes únicos, páginas vistas, total de eventos) —
   mismo componente visual `card` que ya usa `Dashboard.jsx`
3. Gráfica de línea temporal (Recharts `LineChart`, responsive vía
   `ResponsiveContainer` — clave para mobile-first, nunca fijar `width` en px)
4. Gráfica de barras: páginas más visitadas
5. Gráficas de dispositivo y país (`PieChart` o `BarChart`, lo que mejor lea
   en pantalla estrecha — en mobile probablemente barras horizontales, no
   tarta, por legibilidad)
6. Tabla de eventos (`by_event` sumado en el rango, join con
   `analytics_event_definitions` para mostrar `label` en vez de `key`)
7. Sección "Gestión de eventos": lista de `analytics_event_definitions` +
   botón "Nuevo evento"

### 3.4 Modal de gestión de eventos

**Archivo nuevo:** `admin-panel/src/components/analytics/CreateEventDefinitionModal.jsx`
(mismo patrón que `CreateAttributeModal.jsx`: `Button.jsx` reutilizado,
`.modal-overlay`/`.modal` de `App.css`, `useLanguage()`).

Campos: `label` (texto libre) y `key` (autogenerado en `snake_case` desde
`label` al escribir, editable a mano, validado como único por empresa antes
de guardar — mostrar el error de `unique (company_id, key)` de Postgres de
forma legible, no como stack trace).

Además: mostrar junto a cada evento el snippet exacto a copiar, por ejemplo
`data-track-event="whatsapp_click"`, con un botón "Copiar" — así el editor
de la empresa (que puede no ser programador) puede pasárselo directamente a
quien mantenga su web, sin que nadie tenga que recordar la sintaxis.

### 3.5 Nav, ruta e i18n

- `admin-panel/src/components/Sidebar.jsx`: añadir a `navItems`
  `{ to: '/analytics', label: t('nav.analytics'), icon: '📈' }`
- `admin-panel/src/App.jsx`: añadir
  `<Route path="/analytics" element={<Analytics />} />` dentro del bloque
  `AdminLayout` (misma zona que `/items`, `/blog`, etc.)
- `admin-panel/src/locales/es.js` y `en.js`: añadir claves `nav.analytics`,
  y todo el namespace `analytics.*` (título, labels de gráficas, textos del
  modal, mensajes de error) — sin estas dos entradas la pestaña se ve rota
  en uno de los dos idiomas, es fácil de olvidar

### 3.6 Verificación manual

- [ ] Probar en viewport móvil (375px) antes que en desktop — las gráficas
      no deben desbordar horizontalmente, las tarjetas resumen deben apilarse
- [ ] Probar con `data-theme="dark"` — Recharts no hereda las variables CSS
      del proyecto automáticamente, hay que pasarle los colores del tema
      activo explícitamente a cada gráfica (stroke/fill), o quedan ilegibles
      en oscuro
- [ ] Probar con una empresa sin ningún evento dado de alta todavía (estado
      vacío: mensaje + botón "Nuevo evento", no una gráfica vacía confusa)
- [ ] Probar como `viewer`: debe poder ver la pestaña entera pero no debe
      poder crear/editar/desactivar eventos (ocultar o deshabilitar el botón
      "Nuevo evento" y las acciones de la lista si el rol no es editor/admin)

---

## Fase 4 — Snippet reutilizable para webs de empresa

Esto vive **fuera** de `admin-panel` (cada web de empresa es un proyecto
Vercel aparte, no está en este repo — ver `new_feature.md` §1). Lo que se
entrega en esta fase es la plantilla, no un despliegue concreto.

**Archivos nuevos**, pensados para copiar/pegar en cada proyecto de empresa
(o publicarse como paquete npm interno más adelante si compensa el
mantenimiento de un paquete separado):
- `lib/analytics.ts` — contenido exacto de `new_feature.md` §4
  (`trackPageview`, `initAutoTracking`)
- `api/track.ts` — contenido exacto de `new_feature.md` §3

Checklist antes de darlo por listo:
- [ ] `api/track.ts` probado con `event_key` válido, inválido, y ausente
      (debe devolver 204 silencioso en los dos últimos casos, nunca 500)
- [ ] Confirmar que `SUPABASE_SERVICE_ROLE_KEY` se configura como variable
      de entorno del proyecto Vercel de la empresa (no del admin panel) y
      nunca con prefijo `VITE_`
- [ ] Documentar en un README corto (junto a estos dos archivos) los tres
      pasos de integración: variables de entorno, llamar `initAutoTracking()`
      una vez al arrancar, y añadir `data-track-event="..."` a los botones
      que se quieran medir

---

## Fase 5 — Primera empresa real de punta a punta

1. Elegir la primera empresa (candidata natural: la que ya tenga web en
   producción sobre este backend).
2. Desplegar `api/track.ts` en su proyecto Vercel + variables de entorno.
3. Integrar `lib/analytics.ts` (`initAutoTracking()` en el arranque,
   `trackPageview` en el cambio de ruta).
4. Desde el admin panel (pestaña Analítica de esa empresa), dar de alta los
   eventos que se quieran medir además de `form_open`/`form_submit` (si no
   se sembraron en la Fase 1).
5. Añadir `data-track-event="..."` a los botones/CTAs correspondientes en
   la web de la empresa.
6. Esperar al menos un ciclo de `pg_cron` (día siguiente) y verificar que
   `analytics_daily` tiene la fila esperada, y que la pestaña la muestra
   correctamente en mobile y desktop.

---

## Fase 6 — Resto de empresas del multi-tenant

Repetir Fase 5 por cada empresa adicional. Con las Fases 1–4 ya hechas, esto
es solo: copiar los dos archivos del snippet, configurar variables de
entorno, y que el editor de esa empresa dé de alta sus propios eventos desde
el admin — sin tocar ni Supabase ni el admin panel de nuevo.

---

## Fuera de alcance (explícito)

Igual que aclara `new_feature.md`: nada de embudos, atribución de campañas,
audiencias, ni sustituto completo de GA4. Si en el futuro se pide alguna de
estas cosas, es una feature nueva sobre este mismo esquema (`analytics_events`
ya tiene los datos en crudo necesarios durante 35 días), no una reescritura.
