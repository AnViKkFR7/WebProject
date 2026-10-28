# MoiraOrdo CRM · documento de inicio para nuevas webs

Para webs SPA existentes que ya consumen `items` y necesitan activar SEO, sigue
[`ITEMS_SEO_MIGRATION_ROADMAP.md`](./ITEMS_SEO_MIGRATION_ROADMAP.md), además del
contrato técnico [`ITEMS_SEO_INTEGRATION.md`](./ITEMS_SEO_INTEGRATION.md).

Guía viva para conectar un nuevo sitio público con la plataforma MoiraOrdo. Describe el contrato comprobado en el repositorio a **28/10/2026**. Mantenerla actualizada cuando cambien una API, una migración, los permisos o los módulos.

## 1. Qué integra una web pública

El panel Admin concentra el CRM, la gestión de items, presupuestos, facturas, Planning, analítica, correo y controles de empresa. Una web pública no debe reimplementar esas funciones administrativas. Integra solo las capacidades que necesita presentar o iniciar:

| Capacidad | Integración en el sitio | Qué ocurre en Admin |
|---|---|---|
| Catálogo de items | Leer items publicados, atributos y medios del tenant fijo; generar HTML SEO del detalle y sitemap | Items, atributos, archivos y SEO por item |
| Formularios/solicitudes | `api/lead.ts` + `lib/leads.ts` | Bandeja Solicitudes y alta/enlace de contacto CRM |
| Analítica propia | `api/track.ts`, `lib/trackCore.ts`, `lib/analytics.ts`, `lib/consent.ts` | Visitas, páginas, conversiones y eventos en Analítica |
| Blog público | Leer posts y medios publicados siguiendo `BLOG_INTEGRATION.md` | Edición del blog, estados y SEO |
| Aprobación de presupuesto | No crear un flujo paralelo; el panel envía un enlace seguro al cliente | Respuesta con fecha/trazabilidad y notificación a la empresa |
| Facturación y avisos | No exponer tablas financieras ni credenciales desde el sitio público | Emisión, series, cobros, rectificación y recordatorios |
| Planning y resumen semanal | No requieren SDK del sitio | Procesos automáticos internos de Admin |
| Contactos y pipeline | No enviar `contact_id` desde el navegador | Deduplicación, revisión de coincidencias, etapas, asignaciones y seguimiento |
| Privacidad CRM | El formulario recoge la información y explica su uso | Exportación, anonimización y revisión manual de retención |
| Módulos | Ninguna decisión de acceso en el navegador público | Admin del sistema configura módulos; servidor/BD aplica las barreras |

**Importante:** el código de esta carpeta proporciona contratos de integración, no un paquete npm ni un instalador automático. Copiar los archivos indicados y adaptar imports/rutas al framework del proyecto. Los ejemplos de código de integración existentes están en esta carpeta.

## 2. Preparación de empresa y Supabase

1. Crear/verificar la empresa en el panel Admin y obtener su UUID real de `companies`. Cada despliegue público se fija a una sola empresa.
2. Configurar los módulos necesarios en Admin. Los seis módulos (`items`, `blog`, `crm`, `planning`, `billing`, `analytics`) se crean activos por defecto. La configuración puede apagarlos; las rutas y las operaciones servidor/BD deben respetarlo.
3. Asegurar que el esquema compartido de Supabase tiene las migraciones que requieren las funciones elegidas. **No ejecutar todas las migraciones a ciegas**: una instalación existente puede tenerlas ya aplicadas y el orden depende de sus tablas actuales. Usar [`database/README.md`](../database/README.md), sus preflights de solo lectura y el estado real del proyecto Supabase. Los SQL se ejecutan en Supabase, nunca en el proyecto Vite.
4. Dependencias de CRM: esquema de leads; `CRM_CONTACTS_PIPELINE.sql`; `CRM_LEAD_ITEM_ATTRIBUTION.sql`; `CRM_REVIEW_ACTIVITY_LINK.sql`; controles de privacidad; enlaces de facturación y revisión de retención cuando correspondan; módulos aplicados después de las tablas que protegen. Ver el orden completo en el README.
5. Blog SEO público necesita `CONTENT_SEO_FIELDS.sql` y el preflight `CONTENT_SEO_FIELDS_AUDIT.sql` antes de exponer las rutas indexables. Las consultas públicas usan anon key y solo devuelven contenido publicado.
6. Analítica requiere el esquema de analítica y las migraciones de privacidad/engagement descritas en `ANALYTICS_INTEGRATION.md`. Tras `ANALYTICS_ENGAGEMENT.sql`, volver a ejecutar `ANALYTICS_AGGREGATION.sql`, tal como indica esa guía.
7. Facturación, aprobación de presupuestos, emails, vencimientos y automatizaciones son circuitos de Admin. Su secuencia SQL y despliegue Edge están documentados en `database/README.md` y `docs/emails.md`; una web nueva no debe activar cron ni copiar secretos para usarlos.

Una confirmación del usuario sobre una ejecución manual de SQL es evidencia de que la ejecutó, pero no equivale a que esta guía haya inspeccionado la base remota. Ejecutar los preflights en destino cuando se necesite validar el estado actual.

## 3. Variables de entorno

### Cliente público

| Variable | Requisito | Uso |
|---|---|---|
| `VITE_COMPANY_ID` | UUID de la empresa asignada a ese despliegue | Se compila en el navegador; es un identificador público, no un secreto |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Cliente público Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anon/public del mismo proyecto | Solo lectura pública protegida por RLS; no autoriza escritura administrativa |

Las dos variables `VITE_SUPABASE_*` solo son necesarias si el sitio consulta contenido directamente con Supabase. Si usa únicamente APIs servidor, no deben añadirse por costumbre.

### Funciones servidor de Vercel

| Variable | Secreto | Uso |
|---|---|---|
| `SUPABASE_URL` | No, pero solo servidor | API `/api/lead` y `/api/track` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí. Nunca `VITE_`, nunca bundle cliente** | Inserción/validación controlada por los endpoints servidor |
| `ANALYTICS_SALT` | **Sí. Solo servidor** | Hash efímero de visitantes de analítica; `openssl rand -hex 32`, valor distinto por entorno |

No poner claves Resend, Vault ni `service_role` en el navegador. El envío de correos está centralizado en Edge Functions del proyecto Supabase.

## 4. Formularios CRM: obligatorio para captar solicitudes

Seguir [`LEADS_INTEGRATION.md`](./LEADS_INTEGRATION.md). Copiar:

```text
api/lead.ts       ← company-site-snippet/api/lead.ts
src/lib/leads.ts  ← company-site-snippet/lib/leads.ts
```

Usar `submitLead()` para el formulario de contacto y los formularios asociados a items. Enviar nombre, email y/o teléfono, mensaje, versión del texto de privacidad, consentimiento marcado y `source_item` cuando haya una ficha concreta. La librería añade ruta, referrer y UTM. El consentimiento es independiente de la petición de respuesta: no marcarlo automáticamente ni impedir enviar una solicitud si la casilla opcional queda sin marcar.

El endpoint toma el tenant de `VITE_COMPANY_ID` configurado en Vercel, lo valida y rechaza IDs discrepantes del cuerpo. Revisa que CRM esté habilitado en `company_modules`; si no está configurado/activo, falla cerrado. Tras insertar el lead, la BD crea o enlaza el contacto. El sitio **no** busca ni crea contactos ni decide el enlace: la coincidencia por email/teléfono y los conflictos entre dos contactos pasan al flujo de revisión manual de Admin.

No enviar secretos o IDs de contacto en campos ocultos. No cambiar el nombre del honeypot `company_website` sin adaptar contrato y pruebas. Mantener un texto de privacidad propio del negocio y cambiar `consent_text_version` si se modifica.

### Secuencia de envío

1. Validar localmente campos y consentimiento sin borrar el contenido introducido.
2. Llamar a `submitLead`; mostrar éxito solo cuando `{ ok: true }`.
3. Si falla, conservar valores y mostrar el error accesible para reintentar.
4. Si el sitio conserva un email propio adicional, enviarlo después del registro CRM; su fallo no debe hacer creer que el lead no se guardó.
5. No registrar `form_submit` manualmente: la librería dispara `moira:lead-sent` solo tras éxito. Así no se duplica ni se cuentan intentos fallidos.

## 5. Analítica

Seguir [`ANALYTICS_INTEGRATION.md`](./ANALYTICS_INTEGRATION.md). Copiar `api/track.ts` y `lib/{trackCore,analytics,consent}.ts`; llamar `initAutoTracking()` una vez, antes de `trackPageview`, y notificar rutas del router. Añadir `trackNotFound()` a la ruta 404. Los enlaces `tel:`/`mailto:` y el envío confirmado por `submitLead()` se miden automáticamente; eventos propios necesitan configurarse/activarse en Analítica.

El diseño descrito mide sin cookies ni almacenamiento local; respeta Global Privacy Control y oposición. Si se usan GA4/Meta u otras cookies, deben estar bloqueadas hasta consentimiento previo y separadas de la medición propia. El sitio debe incluir política de cookies/privacidad que explique las finalidades y bases aplicables. La guía técnica no sustituye revisión jurídica.

No se almacenan IP, nombre, email, teléfono, query completa ni identificadores persistentes en la analítica. La retención y las limitaciones de medición están detalladas en la guía de integración.

## 6. Items, atributos, imágenes y SEO

La tabla `items` contiene `company_id`, `title`, `summary`, `status`, `item_type`; atributos viven en `attribute_definitions`/`attribute_values` y medios en `item_media`. El esquema base permite lectura pública de items publicados mediante RLS (`items_public_published`); aún hay que filtrar explícitamente por el UUID fijo del tenant en cada consulta. Resolver relaciones de atributos y medios por IDs ya devueltos, no por identificadores recibidos del visitante.

Los campos SEO añadidos para items son `slug`, `seo_title`, `seo_description` y `seo_og_image_url` según `CONTENT_SEO_FIELDS.sql` (el `published_at` solo corresponde a posts). Generar canonical, metadescripción, Open Graph y sitemap solo con items publicados. El slug no debe cambiar sin redirección permanente. No publicar datos privados en un item publicado: el acceso público de RLS significa que el contenido debe tratarse como público. El contrato completo para catálogo, metadatos HTML, sitemap y pruebas está en [`ITEMS_SEO_INTEGRATION.md`](./ITEMS_SEO_INTEGRATION.md).

El blog tiene una guía completa y consultas de ejemplo en [`BLOG_INTEGRATION.md`](./BLOG_INTEGRATION.md). Para SEO social, el HTML inicial debe contener title, descripción, canonical y Open Graph: cambiar `document.title` tras hidratar no basta para todos los rastreadores. Renderizar Markdown sin HTML embebido y responder 404 para borradores/archivados o slugs inexistentes.

## 7. Qué permanece exclusivamente en Admin

- **Contactos y pipeline:** perfil e historial, solicitudes, actividades/notas/llamadas/visitas, responsables, etapas y tareas de seguimiento. El sitio solo capta datos de origen; usar `source_item`, ruta, referrer y UTM con valores reales.
- **Presupuestos y aprobación:** generación, PDF, enlace temporal, decisión del cliente, registro de fecha y aviso a la compañía se orquestan desde el módulo de presupuestos. El sitio no debe fabricar enlaces ni alterar estados.
- **Facturación:** series por empresa, emisión, rectificativas, cobros, historial, PDF y avisos de vencimiento permanecen en el panel/Edge/BD.
- **Plantillas de emails:** la marca y las plantillas de presupuestos y avisos se editan centralmente en Admin y se aplican por empresa. Los correos automáticos internos (Planning, avisos de respuesta, resumen semanal) siguen siendo procesos del backend.
- **Planning y resumen semanal:** cola, cron, exclusiones, bajas e idempotencia son backend; no exponer sus secretos en webs públicas.
- **Módulos:** solo el administrador de plataforma los configura. Ocultar un enlace en el sitio nunca constituye control de acceso; la verificación real está en servidor/BD.

## 8. Seguridad y aislamiento

- Un proyecto/deployment público corresponde a un tenant fijo. No aceptar `company_id` de query, formulario o estado del navegador como selector de empresa.
- Filtrar todas las lecturas públicas por ese `company_id`, incluso cuando RLS ya restringe estados.
- Clave anon en cliente; `service_role` solo dentro de funciones servidor. No exponer datos financieros o personales con consultas anon.
- APIs server-side validan tenant, payload, tamaño, origen y estado del módulo antes de escribir; devuelven errores genéricos sin PII ni secretos.
- No aceptar desde el cliente `crm_contact_id`, asignaciones, etapas internas ni consentimiento afirmado por un dato distinto de la casilla/version enviada.
- Limitar frecuencia y tamaño en formularios y analítica; conservar honeypot y límites del contrato.
- Tratar HTML/Markdown, URLs externas, alt text y UTM como entradas no confiables. Escapar y sanitizar en la salida.
- Nunca probar contra empresas reales ajenas. En este desarrollo, las pruebas con datos reales están autorizadas exclusivamente para **WatchEcommerceDemo**; preferir mocks y datos sintéticos.

## 9. Pruebas de integración antes de producción

Hacer pruebas sin crear registros reales hasta que se haya escogido expresamente el entorno de prueba:

1. `npm test` desde `admin-panel/` para pruebas del snippet compartido y la lógica relacionada.
2. Probar localmente el endpoint con mocks: tenant ausente/incorrecto, CRM apagado, honeypot, validación, consentimiento, ruta/UTM, errores de Supabase y reintento.
3. Comprobar consultas públicas para item/blog publicado y 404 para draft/archived; verificar que ningún dato de otro tenant aparece.
4. Confirmar que ninguna clave `service_role` o de email aparece en JS compilado, source maps públicos o variables `VITE_*`.
5. Revisar móvil, tablet y escritorio (375, 768, 1024 y 1280 px); teclado, lector de pantalla, foco, contraste y estado de error; permitir scroll solo dentro de tablas o carruseles identificados.
6. Revisar Vercel Preview con las variables del tenant de prueba. Revisar logs server-side sin imprimir datos personales.
7. Para un smoke test con filas reales, usar solo el tenant explícitamente aprobado por la persona responsable y eliminar/anonimizar luego con el proceso de privacidad aplicable.

No desplegar a producción desde esta guía. La persona responsable debe revisar variables, migraciones, dominios, privacidad y políticas antes del deploy.

## 10. Resolución de problemas

| Síntoma | Comprobación |
|---|---|
| `/api/lead` devuelve 503 | `VITE_COMPANY_ID` y fila/módulo CRM de ese tenant en `company_modules` |
| `/api/lead` devuelve 500 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, esquema/columnas y logs de Vercel |
| Lead no aparece | Honeypot, tenant, RLS/funciones instaladas y resultado real `{ok:true}` |
| Analítica no aparece | Solo producción, `VITE_COMPANY_ID`, `ANALYTICS_SALT`, evento permitido y migraciones |
| Blog/item no aparece | Tenant fijo, `status='published'`, RLS, migración/campos SEO y slug válido |
| Aprobación/email no llega | Revisar la función Edge central, dominio/secretos en Supabase y log de envío; no crear emisor en el sitio |
| No coinciden email/teléfono del lead | La solicitud queda para revisión manual; resolver en Contactos y pipeline, sin enlace automático forzado |

## 11. Mantenimiento de esta guía

Al cerrar una fase, anotar fecha, rutas/ficheros y versión del contrato cambiado. Mantener las guías específicas (`LEADS_INTEGRATION.md`, `ANALYTICS_INTEGRATION.md`, `BLOG_INTEGRATION.md`) como fuente del detalle de cada API y esta guía como mapa general. Actualizar la tabla de capacidades, variables, migraciones necesarias, pruebas y límites remotos. No afirmar que Supabase, Vercel o Edge están actualizados sin confirmación o una comprobación autorizada.
