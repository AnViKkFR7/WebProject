# Auditoría UX y roadmap de mejora — panel de admin (moira ordo)

**Alcance**: `admin-panel/src`, sin tocar el esqueleto (paleta, sidebar izquierda,
topbar). Auditoría hecha sobre el código + el detector de Impeccable. **No** se ha
podido inspeccionar visualmente con sesión iniciada, así que lo puramente visual se
deduce del código, no de capturas.

---

## 1. Resumen ejecutivo

| # | Dimensión | Nota | Hallazgo principal |
|---|---|---|---|
| 1 | Accesibilidad | 1/4 | 0 estilos `:focus-visible`, 24 `<div onClick>` no navegables con teclado, 0 modales con `role="dialog"` ni cierre con Esc |
| 2 | Rendimiento | 2/4 | Sin code-splitting (Recharts se carga en todas las páginas), Planning descarga **todo** el histórico de tareas |
| 3 | Responsive | 2/4 | Hay menú móvil y 17 breakpoints, pero Planning (4/6 + 2/6 fijo) y las tablas no tienen variante móvil real |
| 4 | Theming | 1/4 | Hay tokens y modo oscuro en `App.css`, pero **618 estilos inline** y **279 colores hex** en JSX; Planning ignora el modo oscuro entero |
| 5 | Coherencia de implementación | 1/4 | Tres sistemas de botones, dos lenguajes visuales, código muerto, `CompanyProvider` duplicado, tipos de dato que no casan entre ficheros |
| | **Total** | **7/20** | **Pobre — necesita una revisión de fondo, no retoques** |

La buena noticia: **el esqueleto es sano** (layout, sidebar colapsable, i18n,
tokens de color con modo oscuro ya definidos). El problema no es de diseño base,
es que cada pantalla se ha construido con su propio criterio y ahora conviven
varias apps dentro de una.

**Los 5 problemas que más daño hacen hoy**

1. **[P0] El selector de empresa no se guarda y su orden es aleatorio** → cada refresco puede cambiarte de empresa sin avisar (§3.1).
2. **[P0] Planning desplaza las tareas 1-2 h en el calendario** por un problema de zona horaria (§3.5).
3. **[P0] Los filtros avanzados de Items fallan** con atributos numéricos y además filtran sólo la página actual (§3.6).
4. **[P1] No hay un sistema de feedback**: 12 `alert()` nativos, y muchos errores se tragan en silencio (`catch → []`) — un fallo de red parece "no hay datos".
5. **[P1] Dos productos visuales en uno**: Planning usa su propio diseño estilo Apple con colores fijos, sin modo oscuro, distinto del resto del panel.

---

## 2. Diagnóstico transversal (patrones, no casos sueltos)

### 2.1 No hay sistema de componentes, hay copias
| Pieza | Variantes encontradas |
|---|---|
| Botón | `.primary-button` / `.ghost-button`, componente `Button.jsx` (`button-primary`), y botones con estilos inline en Planning |
| Modal | Cada página monta el suyo (`.modal-overlay` en Items/MyData, objetos `modalOverlay`/`modalBox` inline en Planning, `DetailModal` en TaskCard) — ninguno con `role="dialog"`, foco atrapado ni Esc |
| Confirmación | `window.confirm`, doble clic "¿Confirmar?" en TaskCard, nada en otros sitios |
| Mensajes | `alert()`, banners `.alert` en MyData, `successMessage` en ItemDetail, `aggregateMessage` en Analytics |
| Selector múltiple | `<select multiple size={1}>` nativo (Items) — exige Ctrl+clic y parece un select simple |
| Iconos | Emojis (📊 🧩 ✏️ 💾 ❌ ✅) con render distinto según sistema operativo |

**Impacto**: cada pantalla se aprende de cero y nada se siente "de la misma marca".

### 2.2 Los errores se esconden
33 `console.error` y muchos `.catch(() => setX([]))`. Si Supabase cae o la RLS
rechaza una consulta, el usuario ve una lista vacía y cree que no tiene datos.
**No hay ni un solo estado de error con acción de reintento.**

### 2.3 Los roles no existen en la interfaz
Sólo 4 usos de `userRole` en toda la UI. Un *viewer* ve "Nuevo item", "Editar",
"Empresas" y "Usuarios"; al pulsar, la RLS rechaza y recibe un error genérico. La
seguridad está bien (en la base de datos), la experiencia no.

### 2.4 Restos y duplicados que confunden
- `CompanyProvider` envuelve la app **dos veces** (`App.jsx` y `AdminLayout.jsx`): se cargan las empresas dos veces y hay dos estados distintos.
- El tema claro/oscuro tiene estado propio en `Sidebar.jsx` **y** en `Topbar.jsx`.
- Huérfanos: `Settings.jsx` (sin ruta), `/media` (con ruta pero sin entrada en el menú), `ItemDetail.jsx.backup`.
- El título de la topbar es fijo ("Panel de administración", sin traducir) y **no dice en qué página estás**.

### 2.5 Detalles que delatan plantilla
El detector marca el **texto con degradado** en todos los títulos de página
(`App.css:515`) y los **bordes laterales de color** en tarjetas
(`TaskCard.jsx:151`, `Planning.jsx:634`, `App.css:2134`). Son los rasgos más
reconocibles de una interfaz genérica. Además, `transition: width` en el sidebar
(`App.css:101`, `:1104`) anima una propiedad de layout — da tirones al colapsar.

---

## 3. Tus focos, uno por uno

### 3.1 Selector de empresa que "se cambia solo"

**Causa raíz** (`contexts/CompanyContext.jsx`), son tres cosas a la vez:
1. Tras cargar, **siempre selecciona `companiesWithRoles[0]`**. No se guarda la elección en ningún sitio.
2. La consulta `.from('companies').select('*').in('id', companyIds)` **no tiene `order by`**. Postgres no garantiza el orden → "la primera" puede ser una distinta en cada refresco. Esto explica exactamente lo que ves.
3. El provider está duplicado (§2.4).

**Además, de UX**: sólo se puede cambiar de empresa desde el Dashboard (el propio
texto lo admite: *"puedes cambiar de empresa volviendo a este dashboard"*).

**Propuesta**
- Persistir el `id` elegido en `localStorage` por usuario; al cargar, restaurarlo si sigue estando entre sus empresas, y si no, caer a la primera **por nombre** (orden estable).
- Un único `CompanyProvider`.
- **Selector en el bloque de marca del sidebar** (ya muestra la inicial y el nombre de la empresa): convertirlo en un desplegable con buscador, el rol de cada empresa y un check en la activa. No cambia el esqueleto, aprovecha un espacio que ya existe.
- Al cambiar: toast "Ahora trabajas en **X**" y recargar los datos de la página actual sin sacar al usuario de ella.

Esfuerzo: **0,5–1 día**.

### 3.2 Atributos: ni intuitiva ni vistosa

**Qué falla hoy**
- Muestra la jerga interna tal cual: `text_array`, `number_array`, `longtext`.
- Los booleanos son emojis ✅/❌ que **no se pueden cambiar aquí**. Los interruptores "Requerido"/"Filtrable" están… dentro del detalle de **un item concreto**, aunque afectan a **todos** los items de ese tipo. Es la confusión de concepto más grave del panel.
- Sólo se puede editar la etiqueta: no hay borrar, ni reordenar, ni cambiar tipo.
- El código ya sabe pintar **listas de opciones** (`validation_rules.options`) pero **no hay ninguna pantalla para definirlas** → función muerta.
- Las etiquetas bilingües se ven y se editan como JSON crudo (`{"es":"Año","en":"Year"}`).

**Propuesta — de tabla técnica a "constructor de fichas"**
- **Dos paneles**: a la izquierda los *tipos de item* como tarjetas (nombre, nº de atributos, nº de items); a la derecha los atributos del tipo elegido.
- Cada atributo como fila con **icono y nombre humano del tipo** ("Texto corto", "Texto largo", "Número entero", "Decimal", "Sí / No", "Fecha", "Lista de opciones", "Etiquetas") e **interruptores reales** de Requerido y Filtrable.
- **Panel lateral de edición**: etiqueta en **dos campos ES / EN** (se guarda el JSON por debajo, el usuario nunca lo ve), clave autogenerada y de sólo lectura, tipo, y **editor de opciones** para "Lista de opciones".
- **Arrastrar para ordenar** (requiere columna `sort_order`) → el orden se respeta en el formulario de items.
- **Borrar con aviso de impacto**: "12 items tienen un valor en este atributo".
- **Vista previa** a la derecha de cómo queda el formulario de un item con estos atributos.
- Quitar los interruptores del detalle del item.

Esfuerzo: **3–4 días** (incluye migración de `sort_order`).

### 3.3 Todo lo de `/profile` está escondido

**Qué falla**: el único acceso es clicar el nombre arriba a la derecha (que además
no parece un botón: es un `<div>` sin cursor ni indicio). Y dentro de "Perfil"
conviven dos cosas que no tienen nada que ver:
- **Mis cosas**: datos personales, seguridad, mi ficha en la empresa.
- **Administración**: crear empresa, crear usuario, asignar usuario — que **duplican** el propósito de las páginas `/companies` y `/users`.

**Propuesta**
- **Menú de usuario desplegable** en la topbar (avatar + nombre real + rol): *Mi perfil · Seguridad · Idioma · Tema · Cerrar sesión*. Hoy idioma, tema y logout están sueltos como iconos.
- **Mover la administración a su sitio**: botón "Nueva empresa" en `/companies` y "Invitar usuario" (con su modal de asignación) en `/users`, visibles sólo para admin.
- `/profile` se queda con lo personal, con pestañas en la URL (`/profile/seguridad`) para poder enlazarlas.
- Entrada "Mi cuenta" en el pie del sidebar, que ya existe en móvil.

Esfuerzo: **1,5–2 días**.

### 3.4 Blog → ver §4 (viabilidad y plan, fuera de este alcance)

### 3.5 Planning: robustez

**[P0] Desfase horario.** El formulario envía `2026-10-21T10:00` **sin zona horaria**
a una columna `timestamptz`; Supabase lo guarda como 10:00 **UTC**. Luego:
- la tarjeta pinta la hora cortando el texto (`slice(11,16)`) → muestra **10:00**,
- pero la rejilla la coloca con `new Date()` en hora local → la pinta a las **12:00** en verano (11:00 en invierno).

La etiqueta y la posición no coinciden, y cualquier recordatorio por email se
calcularía mal. **Es prerrequisito de los recordatorios.** Arreglo: enviar siempre
ISO con offset (o convertir explícitamente a UTC al guardar) y formatear **siempre**
desde `Date` en local, nunca cortando strings.

**[P1] Otros puntos frágiles**
- Los errores de carga se tragan (`catch(() => setTasks([]))`); borrar falla en silencio.
- Se descarga **todo el histórico** de tareas sin rango de fechas — irá a peor con el uso.
- Al editar una tarea y añadir archivos, **se reemplazan** los adjuntos anteriores en vez de sumarse.
- Bucket `media-planner`: se guarda una URL pública pero luego se pide URL firmada — hay que decidir si es público o privado.
- Borrar una ocurrencia de una tarea recurrente borra **toda la serie** sin avisar.
- La selección de empresas cliente se pierde al refrescar.
- Colores fijos (74 hex en `Planning.jsx`): sin modo oscuro, distinto al resto.
- El layout 4/6 + 2/6 no tiene versión móvil.

**Recordatorios por email** (momento del evento · 1 h · 1 día · 1 semana antes)

Viable con lo que ya tenéis (`pg_cron` ya funciona para la analítica):

```
planning_task.reminders int[]        -- minutos antes: {0, 60, 1440, 10080}
planning_reminder_log                -- (task_id, occurrence_at, offset, sent_at) UNIQUE
                                        evita enviar dos veces el mismo aviso
pg_cron cada 5 min → Edge Function send-planning-reminders
  1. tareas con algún recordatorio en la ventana [ahora, ahora+5min]
  2. expandir recurrencias en servidor (misma lógica que lib/recurrence.js, en Deno)
  3. enviar con Resend/Postmark y registrar en el log
```

Decisiones a tomar: **a quién** se envía (hoy no existe "asignado"; propongo el
creador + opción de añadir emails), **proveedor** de email y verificar el dominio
(SPF/DKIM) para no caer en spam. En el formulario: casillas de recordatorio con
"1 h antes" marcada por defecto.

Esfuerzo: robustez **2 días** + recordatorios **2–3 días**.

### 3.6 Items: filtros, mosaico por defecto, y volver atrás sin perderlos

**[P0] Dos bugs en los filtros avanzados**
1. **Tipos que no casan**: el formulario crea atributos `integer`/`decimal`, pero el filtro (`itemService.js:76-93`) sólo reconoce `number`. Con un atributo numérico el filtro lee `value_text` (vacío) → **nunca encuentra nada**.
2. **Filtran sólo la página actual**: el servidor pagina de 20 en 20 y **luego** se filtra en el navegador. Un filtro puede dejar la página 1 vacía aunque haya coincidencias en la 3, y el total de páginas no cuadra. Igual con las opciones del desplegable: sólo salen valores de los 20 items visibles.

**Propuesta**
- Mover el filtrado por atributos **al servidor** (función RPC en Postgres) → paginación y totales correctos. Opciones de cada filtro con una consulta `distinct` sobre toda la empresa.
- **Todo el estado en la URL** (`?status=published&type=property&q=…&attr.price=…&page=2&view=cards`). Volver desde un item lo restaura tal cual, el botón atrás funciona, y los filtros se pueden compartir por enlace.
- Mosaico por defecto (`view=cards`). Ojo: quien ya eligió "filas" lo conserva por la preferencia guardada.
- Sustituir el `<select multiple>` por un multiselect con buscador y **chips de filtros activos** quitables uno a uno.
- Estado vacío útil: "Ningún item coincide con estos filtros · [Quitar filtros]".

Esfuerzo: **2–3 días**.

---

## 4. Blog: ¿es posible? Sí. Plan (fuera de este alcance)

**Viabilidad**: las webs de empresa son SPAs (Vite + React Router en Vercel) que ya
leen de Supabase con su `company_id`, y la base de datos ya tiene `blog_posts` y
`blog_media` con política pública para lo publicado. Falta poco en datos y mucho en
producto. Hoy `Blog.jsx` es sólo un cartel de "próximamente".

**Cómo encaja "crear pestañas automáticamente"**: cada web incorpora **una vez** dos
rutas genéricas (`/blog` y `/blog/:slug`) y una entrada de menú que sólo aparece si
hay artículos publicados. A partir de ahí, publicar desde el admin hace aparecer el
contenido sin tocar la web — el mismo patrón que el snippet de analítica.

Si se quiere ir más allá del blog (páginas libres como "Servicios" o "Quiénes
somos"), es la misma pieza generalizada: una tabla `site_pages` con `slug`, título,
contenido y posición en el menú.

**Lo que hay que añadir**
- Esquema: `slug` (único por empresa), `excerpt`, `cover_url`, `published_at` (y programación), `seo_title`, `seo_description`, autor, etiquetas, versión en/es.
- Formato del cuerpo: **Markdown o bloques JSON**, no HTML libre (riesgo de XSS en la web pública).
- Editor en el admin con previsualización.
- **El punto delicado: SEO.** Una SPA renderiza en el navegador; Google lo indexa, pero peor y más lento, y **las previsualizaciones al compartir en WhatsApp/LinkedIn no funcionan** sin HTML en servidor. Hace falta prerender o una función de Vercel que sirva los meta tags por `slug`, más `sitemap.xml` dinámico.

**Fases**: (1) esquema + editor + listado en admin, 3 días · (2) rutas y menú dinámico en una web piloto, 1-2 días · (3) SEO: meta tags en servidor + sitemap, 2 días · (4) réplica en el resto de webs, ~0,5 días/web.

**Recomendación**: no borrar la pestaña; ocultarla del menú hasta que la fase 1 esté lista, para no enseñar un "próximamente" a clientes.

---

## 5. Ideas de features para tus clientes

Ordenadas por valor/esfuerzo, aprovechando lo que ya existe.

| Idea | Por qué encaja | Esfuerzo |
|---|---|---|
| **Bandeja de solicitudes (leads)** — guardar en Supabase lo que llega por el formulario de contacto de cada web, con estados (nuevo / contactado / cerrado) | Ya medís `form_submit` en analítica; esto pone **la persona detrás del número**. Es lo que más valor percibido da a una pyme | M |
| **Presupuestos y facturas** integrados, con clientes de `client_company` | Ya está diseñado (proyecto Arquelia); dentro del admin gana persistencia y clientes autorrellenados | L |
| **Dashboard de verdad** — visitas de la semana, items publicados, próximas tareas, solicitudes sin responder | Hoy el Dashboard es sólo un selector de empresa | S |
| **Informe semanal por email** (visitas, clics, tareas) | Reutiliza la infraestructura de email de los recordatorios | S |
| **Historial de cambios** — "quién cambió qué y cuándo" | Ya guardáis `created_by` / `last_edited_by` en todas las tablas | S |
| **Acciones en bloque** en Items (publicar, archivar, duplicar, exportar CSV) | Para clientes con catálogos grandes (ecommerce) | S |
| **SEO por item** — título y descripción meta con vista previa tipo Google | Las webs ya pintan los items; mejora su posicionamiento directamente | S |
| **Buscador global** (Ctrl+K) sobre items, clientes y tareas | Atajo de usuario avanzado, encaja con el sidebar actual | M |
| **Optimización de imágenes al subir** (redimensionar + WebP) | Ya existe `public/subir-imagenes.html`; integrarlo en la subida evita webs lentas | S |
| **Reseñas/testimonios** gestionados desde el admin | Todas las webs tienen sección de testimonios fija en código | M |
| **Checklist de arranque** por empresa (logo, primer item, conectar analítica) | Reduce la dependencia de ti en la puesta en marcha | S |

---

## 6. Roadmap

Ordenado para que cada fase deje el panel mejor que la anterior y **no se
construya diseño sobre bugs**.

### Fase 0 — Robustez crítica (≈ 4 días) — ✅ hecha
- [x] Selector de empresa persistente, orden estable, provider único y selector en el sidebar (§3.1).
- [x] Zona horaria de Planning (§3.5) — `lib/dates.js` + `PLANNING_TIMEZONE_FIX.sql` para los datos existentes.
- [x] Filtros de Items: tipos de dato, filtrado en servidor, estado en URL, mosaico por defecto (§3.6).
- [x] Sistema de **toasts** + **diálogo de confirmación** únicos; eliminados los 12 `alert()`/`confirm()`.
- [x] Estados de error con "Reintentar" en Dashboard, Items y Planning.
- [x] Tests (`npm test`, vitest) de los bugs de zona horaria y filtros.
- Pendiente: `prompt()` nativo para la descripción de PDFs en `ItemMedia.jsx` (pasa a la Fase 1 con el componente `Modal`).

### Fase 1 — Sistema de diseño (sin tocar el esqueleto) ✅ hecha
- [x] Componentes en `src/components/ui/`: `Icon`, `Modal` (role="dialog", foco atrapado, Esc, devuelve el foco), `MultiSelect`, `Toggle`, `EmptyState`, `PageHeader`. `Button` añade la variante `danger`.
- [x] Set de iconos SVG (`Icon`) en lugar de emojis en todos los `.jsx`: sidebar, topbar, items, ficha de item, atributos, perfil, analítica, empresas, usuarios, páginas legales.
- [x] `:focus-visible` global, `::selection` con el color de marca, hover solo en `@media (hover: hover)`.
- [x] Fuera el texto degradado de los títulos y el borde lateral rojo de los campos obligatorios (ahora asterisco + borde tenue).
- [x] Sidebar: ya no anima `width`; el ancho cambia de golpe y lo que entra con animación (opacity + transform) es el texto.
- [x] Modales migrados: confirmación, crear tipo de item, crear atributo, crear evento, filtros avanzados, crear item, reordenar imágenes, vista previa de PDF.
- [x] `prompt()` de PDFs sustituido por un modal con un campo de descripción por archivo.
- [x] Filtros de Items con `MultiSelect` (antes `<select multiple>`). Filas y tarjetas son enlaces reales (se pueden abrir en otra pestaña y recorrer con teclado). Estado vacío con acción.
- [x] `<div onClick>` → `<button>`: user chip (topbar y sidebar), tarjetas de tarea y de factura de Planning.
- Queda para la Fase 4 (Planning): el modal de detalle de factura y los estilos inline/hex de Planning; el clic en hueco vacío del calendario sigue siendo un atajo de ratón (con teclado se usa "Nueva tarea"). Las etiquetas de tipo de tarea en `locales` aún llevan emoji.
- Queda para la Fase 3 (Atributos): los estilos inline de `AttributeItem`, `AttributeDefinitionsTable` y `AttributeDefinitionsForm`, que se rehacen enteros.
- El `Toggle` está creado pero sin estrenar: los checkboxes actuales están en Atributos y Planning, que se rehacen en sus fases.

### Fase 2 — Navegación y arquitectura de la información ✅ hecha
- [x] Menú de usuario en la topbar (`UserMenu`): nombre real del miembro + rol · Mi perfil · Seguridad · Idioma · Tema · Cerrar sesión. Fuera los botones sueltos de idioma, tema y logout.
- [x] `/profile` solo con lo personal y pestañas en la URL (`/profile`, `/profile/security`, `/profile/company`).
- [x] Administración fuera de `/profile`: "Crear usuario" y "Asignar a empresa" en `/users`; "Nueva empresa" al pie del selector de empresa (es una empresa del panel, no una empresa cliente). Visibles solo para el admin de plataforma.
- [x] Título de la página actual en la topbar y en la pestaña del navegador (`lib/navigation.js`).
- [x] Sidebar agrupada: Contenido · Operación · Administración, con "Mi cuenta" al pie (escritorio y móvil). Plegada, los grupos se separan con una línea.
- [x] Según rol (`lib/permissions.js`, mismo claim `app_role` que la RLS): un viewer no ve Administración ni los botones de crear/editar en Items, Atributos y Planning.
- [x] Fuera `Settings.jsx`, `Media.jsx` (y su ruta `/media`) e `ItemDetail.jsx.backup`.
- [x] **`/companies` rehecha**: ahora son solo las *empresas cliente* de la empresa seleccionada (alta, edición, color y borrado con aviso de impacto). Antes mezclaba dos cosas: listaba `client_company` filtrando por quien las creó y al guardar escribía en la tabla `companies`.
- [x] **El Dashboard pasa a ser el resumen de la empresa** en vez de un selector de empresa (que ya está en el menú lateral desde la Fase 2): items por estado, tipos y atributos, próximas tareas, tráfico de los últimos 30 días, empresas cliente con lo pendiente de cobrar y pagar, y miembros por rol. Cada tarjeta enlaza a su pestaña.

### Fase 3 — Atributos ✅ hecha (requiere ejecutar `ATTRIBUTES_SCHEMA.sql`)
- [x] Dos paneles: tipos de item como tarjetas (nº de atributos e items) y atributos del tipo elegido; el tipo elegido va en la URL (`/my-data?type=…`).
- [x] Cada atributo con icono y nombre humano del tipo, clave visible e interruptores reales de Requerido y Filtrable (se guardan al momento).
- [x] Panel lateral de edición: nombre ES / EN (el JSON no se ve), clave autogenerada y de solo lectura, tipo, editor de opciones.
- [x] "Lista de opciones" funciona por fin: la columna `validation_rules` no existía; la crea la migración.
- [x] Reordenar arrastrando o con botones subir/bajar (teclado y móvil); el orden (`sort_order`) se usa en el formulario de crear item y en la ficha.
- [x] Borrar con aviso de impacto ("12 items tienen un valor…"). Si hay valores, el tipo solo puede cambiar a otro que los conserve.
- [x] Vista previa del formulario del item.
- [x] Fuera los interruptores Requerido/Filtrable del detalle del item. Las etiquetas JSON ya no se ven crudas en Items.
- Migración: `ATTRIBUTES_SCHEMA.sql` (añade `sort_order` y `validation_rules`, ordena lo existente por fecha de creación). Sin ella, reordenar y guardar opciones muestra un aviso claro en vez de fallar en silencio.
- [x] RLS: el rol `admin` de empresa ya puede escribir. Las 16 políticas de escritura y la función de analítica comprobaban solo `editor`. Corregido en los ficheros de esquema y en la migración `RLS_ADMIN_WRITE_FIX.sql`.
- Pendiente de decisión: editar miembros en `/users` (nombre, teléfono y rol) es un UPDATE sobre `company_members`, reservado al admin de plataforma. Un admin de empresa ve el botón de editar y al guardar recibe un error. Hay que decidir si un admin de empresa debe gestionar los miembros de su empresa.

### Fase 4 — Planning ✅ hecha (requiere `PLANNING_REMINDERS.sql` para los recordatorios)
- [x] Tokens y modo oscuro: fuera los 76 hex fijos. Todo en `styles/planning.css`; el color de cada empresa sigue siendo dinámico, pasado como variable CSS.
- [x] Versión móvil: el 4/6 + 2/6 se apila, el calendario deja de medirse contra la ventana y la barra superior se reordena.
- [x] `Planning.jsx` pasa de 786 líneas a orquestación: `BillingView`, `TaskFormModal`, `BillingFormModal`, `ClientCompanyModal`, `AttachmentsField` y `lib/invoicePdf.js` en sus propios ficheros.
- [x] Los modales de tarea, factura, empresa y detalle usan el `Modal` común (Esc, foco atrapado, `role="dialog"`).
- [x] Solo se descarga el tramo visible del calendario, no todo el histórico (`lib/planningRange.js`). Las tareas y facturas recurrentes se traen siempre: su fila puede ser antigua y tener ocurrencias dentro del rango.
- [x] Al editar y adjuntar, los archivos anteriores se conservan (`lib/attachments.js`); quitar uno es explícito.
- [x] Borrar una ocurrencia de una serie avisa de que se borran todas.
- [x] La selección de empresas cliente se recuerda por empresa (antes se perdía al refrescar).
- [x] Bucket `media-planner` tratado como privado: se guarda la ruta y se abre con URL firmada. Antes se guardaba una URL pública que no abría.
- [x] Recordatorios por email: minutos antes (al empezar, 1 h, 1 día, 1 semana) en el formulario de tarea, columna `reminders`, cron cada 5 minutos y Edge Function `send-planning-reminders`.
- [x] Fuera los emojis de los textos (tipos de tarea, empresas, usuarios).
- [x] Los recordatorios cubren también las tareas que se repiten: la ocurrencia se calcula en SQL con las mismas reglas que el panel (tope de 200 repeticiones y 3 años), sin materializar filas.
- [x] El cron no manda ninguna clave de Supabase: manda un secreto propio guardado en Vault (`cron.job` guarda el comando en claro y lo lee cualquiera con acceso a la base de datos). Así la migración de Supabase a las claves nuevas `sb_secret_…` no obliga a tocar el montaje.
- **Envío aplazado** (dominio sin verificar en IONOS/Resend): la parte A de `PLANNING_REMINDERS.sql` se puede ejecutar ya (el panel guarda los recordatorios de cada tarea); la parte B (el cron) queda para cuando haya dominio verificado y la función desplegada. El bucket `media-planner` debe estar marcado como privado en Supabase.

### Fase 5 — Dashboard y primeras features ✅ hecha
- [x] Dashboard con métricas reales (hecho junto con "Mi Compañía").
- [x] **Carga diferida por ruta**: el JS inicial baja de 1.553 KB a 514 KB. Analítica (397 KB) y Planning van en su propio trozo, y `xlsx` (419 KB) solo se descarga al importar o pedir la plantilla, no al abrir Atributos. Barra fina de progreso mientras llega el trozo.
- [x] **Bandeja de solicitudes** (`/leads`): lo que llega por el formulario de contacto de cada web, con estados nueva → contactada → cerrada, buscador, notas internas y aviso visual si una solicitud nueva lleva más de 2 días sin responder. Tarjeta en el Dashboard con las que faltan por responder.
  - Base de datos: `database/schema/LEADS_SCHEMA.sql`. La tabla **no** tiene política de insert: las webs escriben por su propia función de servidor con la service role key, igual que la analítica.
  - Integración en las webs de cliente: `company-site-snippet/LEADS_INTEGRATION.md` (+ `api/lead.ts` y `lib/leads.ts`), con prompt de arranque incluido.
- Informe semanal por email: aplazado, depende del correo (dominio sin verificar).

### Fase 6 — Siguientes features (sin empezar)
De la lista de §5, las que mejor encajan ahora: acciones en bloque en Items,
SEO por item, historial de cambios y buscador global.

### Fuera de alcance — Blog / páginas dinámicas
Plan de §4, cuando se decida abordarlo.

**Total Fases 0–4: ≈ 18–20 días.** El mayor salto de calidad percibida por euro
invertido está en **Fase 0 + Fase 1**: son las que hacen que el panel deje de
"fallar raro" y empiece a parecer un único producto.

---

## 7. Lo que está bien y hay que conservar

- **Esqueleto y tokens**: la paleta y el modo oscuro de `App.css` están bien planteados; el problema es que no se usan en todas partes.
- **i18n de base**: `useLanguage()` + `t()` está extendido en casi toda la app; sólo hay huecos puntuales.
- **Seguridad en la base de datos**: RLS con helpers coherentes (`is_company_member`, `has_company_role`). La UI sólo tiene que reflejarla.
- **Funcionalidad**: el panel hace muchas cosas y las hace — Items, atributos dinámicos, analítica, planning con recurrencia. Todo esto es **pulir y unificar**, no rehacer.
