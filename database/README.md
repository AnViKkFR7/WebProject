# Base de datos

Todo el SQL del proyecto. Se ejecuta pegándolo en el **SQL Editor de Supabase**.

| Carpeta | Qué contiene |
|---|---|
| `schema/` | Cómo está montada la base de datos. Es la referencia: si algo cambia en Supabase, se actualiza aquí. |
| `migrations/` | Cambios puntuales sobre una base de datos que ya existe. Se ejecutan una vez. |
| `maintenance/` | Limpiezas y arreglos de datos. Se ejecutan cuando hacen falta. |
| `local/` | **No va a git.** Para tus copias con valores reales (claves, ids). |

Las migraciones se aplican una vez y en el orden indicado. Algunas usan
`IF NOT EXISTS` para facilitar recuperación, pero eso no las convierte en una
reconciliación segura ni autoriza a repetirlas a ciegas. Los scripts de
`maintenance/` requieren revisar su propio alcance; algunos son destructivos.
En una base ya existente, consulta el historial real de migraciones y ejecuta
solo las que falten: no repitas los ocho esquemas base ni los pasos de datos.

## Orden de ejecución en una base de datos nueva

1. `schema/DB_SCHEMA.sql` — tablas principales, helpers de permisos y RLS.
2. `schema/ITEM_MEDIA_STORAGE.sql` — imágenes y PDFs de los items.
3. `schema/USER_FILTER_PREFERENCES.sql` — filtros guardados por usuario.
4. `schema/ANALYTICS_SCHEMA.sql` — eventos y tabla diaria de analítica.
5. `schema/ANALYTICS_AGGREGATION.sql` — agregación por cron y botón "Actualizar ahora".
6. `schema/PLANNING_SCHEMA.sql` — RLS de empresas cliente, tareas y facturación.
7. `schema/ATTRIBUTES_SCHEMA.sql` — orden de los atributos y listas de opciones.
8. `schema/LEADS_SCHEMA.sql` — bandeja de solicitudes de las webs.
9. Aplicar las mejoras de analítica: `migrations/ANALYTICS_PRIVACY_UPGRADE.sql`, después `migrations/ANALYTICS_ENGAGEMENT.sql` y, por último, volver a ejecutar `schema/ANALYTICS_AGGREGATION.sql`.
10. Aplicar `migrations/CONTENT_SEO_FIELDS.sql`, `migrations/COMPANY_MEMBER_ACCESS.sql` y `migrations/RLS_ADMIN_WRITE_FIX.sql` (las dos últimas si no están ya incorporadas en la base inicial). Después, ejecutar el informe de solo lectura `maintenance/CONTENT_SEO_FIELDS_AUDIT.sql` y resolver slugs pendientes antes de integrar el blog público.
11. Para Planning: primero revisar el resultado de `maintenance/BILLING_SECURITY_AUDIT.sql` (§3); después `migrations/PLANNING_TENANT_HARDENING.sql`, `migrations/PLANNING_TASK_MOVE_UNDO.sql`, la **Parte A solamente** de `migrations/PLANNING_REMINDERS.sql`, `migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql`, `migrations/PLANNING_EMAIL_QUEUE.sql` y `migrations/PLANNING_STORAGE_HARDENING.sql`.
12. Aplicar `migrations/CRM_CONTACTS_PIPELINE.sql`, después `migrations/CRM_LEAD_ITEM_ATTRIBUTION.sql`, `migrations/CRM_REVIEW_ACTIVITY_LINK.sql` y luego `migrations/CRM_PRIVACY_CONTROLS.sql`.
13. Aplicar la cadena de documentos en este orden: `migrations/INVOICING.sql` → `migrations/QUOTES.sql` → `migrations/BILLING_SECURITY_HARDENING.sql` → `migrations/BILLING_DOCUMENT_PRESENTATION.sql` → `migrations/BILLING_APPEARANCE.sql`.
14. Después de `BILLING_APPEARANCE.sql`, aplicar `migrations/BILLING_DRAFTS.sql`, `migrations/BILLING_NAMED_PALETTES.sql` y `migrations/BILLING_DIRECTORY_CATALOG.sql` (estos tres dependen de la apariencia o del directorio de Planning).
15. Continuar con `migrations/BILLING_CHAPTER_TEMPLATES.sql` → `migrations/BILLING_PAYMENTS_HISTORY.sql` → `migrations/BILLING_ISSUED_INVOICE_LOCK.sql` → `migrations/BILLING_RECTIFYING_INVOICES.sql`.
16. Aplicar `migrations/BILLING_QUOTE_APPROVAL.sql` después de `QUOTES.sql`, seguida por `migrations/BILLING_QUOTE_APPROVAL_REVISIONS.sql` para conservar respuestas por versión/enlace y `migrations/BILLING_QUOTE_APPROVAL_DASHBOARD_HANDLING.sql` para marcar respuestas como tratadas por usuario. Aplicar `migrations/CRM_BILLING_LINKS.sql` después de `CRM_PRIVACY_CONTROLS.sql`, `INVOICING.sql` y `QUOTES.sql`. Después ejecutar `migrations/CRM_RETENTION_REVIEW.sql` para configurar plazos de revisión, que no borran datos.
17. Ejecutar `migrations/COMPANY_MODULES.sql` **después de todos los pasos anteriores**. Esta migración instala políticas y triggers que nombran `planning_task_moves`, `planning_email_queue`, contactos, facturas, cobros, borradores, paletas, catálogo, plantillas y tablas de analítica; no basta con tener las tablas base de la instalación.
18. Ejecutar `migrations/COMPANY_MODULES_PLATFORM_ADMIN.sql` después de `COMPANY_MODULES.sql`. La configuración queda reservada al administrador del sistema.
19. Ejecutar `migrations/BILLING_DUE_REMINDERS.sql` después de `BILLING_PAYMENTS_HISTORY.sql`, `BILLING_RECTIFYING_INVOICES.sql` y `COMPANY_MODULES.sql`.
20. Ejecutar `migrations/COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql` después de `BILLING_APPEARANCE.sql`, `COMPANY_MODULES.sql` y `BILLING_DUE_REMINDERS.sql`. Validar permisos/contrato con `maintenance/COMPANY_CUSTOMER_EMAIL_TEMPLATES_PREFLIGHT.sql` antes de usar la pestaña o activar plantillas personalizadas en Edge.
21. Ejecutar `migrations/WEEKLY_SUMMARY_EMAIL.sql` después de los pasos 9–20.
22. Ejecutar `migrations/WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` después de la migración anterior: activa el resumen para empresas existentes y nuevas, cada lunes a las 09:00 (Madrid), sin ajustes en el panel.
23. Los cron son **opcionales y siempre van al final**. Para Planning, desplegar `send-planning-reminders`, configurar su Edge Secret y Vault, y ejecutar solo la **Parte B** de `migrations/PLANNING_REMINDERS.sql`. Para facturas: desplegar `send-billing-due-reminders`, configurar Edge Secrets y Vault, y ejecutar `migrations/BILLING_DUE_REMINDERS_CRON.sql`. Para resumen: desplegar `send-weekly-summary`, crear sus dos entradas Vault y ejecutar `migrations/WEEKLY_SUMMARY_EMAIL_CRON.sql`. Los nombres exactos de secretos y pasos están en `docs/setup-servicios-externos.md`.
23. `migrations/PLANNING_TIMEZONE_FIX.sql` es una corrección de datos posterior al panel nuevo, no un paso genérico de instalación. Ejecútala solo cuando se actualice una instalación antigua y se haya revisado la interpretación de fechas.

**Las migraciones de analítica no están dobladas dentro de `schema/`.** La
secuencia exacta está incluida en el paso 9 de arriba. `schema/BDD_REFERENCIA.sql`
no se ejecuta: es un volcado de la estructura real, útil para consultar tipos y
claves ajenas.

## Migraciones

| Fichero | Para qué | Cuándo |
|---|---|---|
| `migrations/CONTENT_SEO_FIELDS.sql` | Slug y metadatos SEO de items/posts, unicidad por compañía y fecha de publicación. | Después de `DB_SCHEMA.sql` (y una vez creadas `items` y `blog_posts`); antes de usar los nuevos campos. |
| `migrations/CRM_CONTACTS_PIPELINE.sql` | Contactos, etapas por empresa, actividades, consentimiento/origen y vinculación automática de solicitudes con revisión de coincidencias ambiguas. | Después de `DB_SCHEMA.sql`, `PLANNING_SCHEMA.sql` y `LEADS_SCHEMA.sql`; antes de habilitar `/contacts` o enviar campos CRM nuevos desde las webs. |
| `migrations/CRM_LEAD_ITEM_ATTRIBUTION.sql` | Añade el item público de origen a solicitud/contacto; sincroniza la atribución cuando se resuelve un vínculo ambiguo y la limpia al anonimizar. | Después de `CRM_CONTACTS_PIPELINE.sql`; antes de integrar `source_item` en las webs cliente. Ejecutar el preflight `maintenance/CRM_LEAD_ITEM_ATTRIBUTION_PREFLIGHT.sql`. |
| `maintenance/CRM_LEAD_ITEM_ATTRIBUTION_PREFLIGHT.sql` | Comprueba presencia de columnas y trigger de sincronización sin leer datos de solicitudes/contactos ni modificarlos. | Después de aplicar `CRM_LEAD_ITEM_ATTRIBUTION.sql`; ejecutar en Supabase SQL Editor y revisar que las cuatro comprobaciones sean `true`. |
| `migrations/CRM_REVIEW_ACTIVITY_LINK.sql` | Al resolver manualmente una solicitud ambigua, vincula también su actividad de formulario con el mensaje original a la cronología del contacto; trigger idempotente, sin RPC adicional. | Después de `CRM_CONTACTS_PIPELINE.sql` y antes de `CRM_PRIVACY_CONTROLS.sql`. |
| `migrations/CRM_PRIVACY_CONTROLS.sql` | Exportación JSON y anonimización transaccional de ficha, solicitudes vinculadas y timeline; permiso admin y auditoría sin PII. | Después de `CRM_CONTACTS_PIPELINE.sql` y antes de `COMPANY_MODULES.sql`. No configura plazos ni elimina documentos fiscales. |
| `migrations/CRM_BILLING_LINKS.sql` | Asociación manual y unívoca de facturas/presupuestos con contactos de la misma empresa; el export incluye las copias de documentos y anonimizar elimina solo los enlaces. | Después de CRM, privacidad, `INVOICING.sql`, `QUOTES.sql` y antes de `COMPANY_MODULES.sql`. |
| `migrations/CRM_RETENTION_REVIEW.sql` | Plazos de revisión configurables por empresa para solicitudes sin vincular y contactos inactivos; muestra solo conteos y no borra datos. | Después de `CRM_PRIVACY_CONTROLS.sql` y `CRM_BILLING_LINKS.sql`; antes de `COMPANY_MODULES.sql`. |
| `migrations/BILLING_QUOTE_APPROVAL.sql` | Enlaces privados de un solo uso, vencimiento, aceptación/rechazo registrado y trazabilidad de identidad declarada. | Después de `QUOTES.sql`; antes de `COMPANY_MODULES.sql`. |
| `migrations/BILLING_QUOTE_APPROVAL_REVISIONS.sql` | Permite una nueva respuesta al reemitir un enlace tras modificar un presupuesto rechazado, conserva el historial inmutable y devuelve estado/versión actuales para refresco del panel. | Después de `BILLING_QUOTE_APPROVAL.sql`; antes de `COMPANY_MODULES.sql`. |
| `migrations/BILLING_QUOTE_APPROVAL_DASHBOARD_HANDLING.sql` | Añade el estado leído/tratado por usuario para respuestas recientes del dashboard; conserva inmutable la respuesta del cliente y oculta solo la fila tratada a ese usuario. | Después de `BILLING_QUOTE_APPROVAL_REVISIONS.sql`; antes de desplegar el panel actualizado. |
| `migrations/COMPANY_MODULES.sql` | Preferencias por empresa, todos activos por defecto y barreras RLS/triggers para lecturas y escrituras directas o por RPC; desactiva la cola de avisos de Planning al apagar ese módulo. | Después de `PLANNING_TASK_MOVE_UNDO.sql`, CRM, `CRM_PRIVACY_CONTROLS.sql`, `CRM_BILLING_LINKS.sql`, `CRM_RETENTION_REVIEW.sql`, `PLANNING_EMAIL_QUEUE.sql`, analítica, `INVOICING.sql`, `QUOTES.sql`, `BILLING_QUOTE_APPROVAL.sql` y todas las migraciones que crean tablas de facturación existentes. Después aplicar `COMPANY_MODULES_PLATFORM_ADMIN.sql`. |
| `migrations/COMPANY_MODULES_PLATFORM_ADMIN.sql` | Solo el administrador del sistema puede cambiar la configuración mediante RPC; los miembros conservan lectura de los módulos activos que necesita el panel. Revoca `UPDATE` directo. | Después de `COMPANY_MODULES.sql` y antes de la versión del panel con el menú de módulos restringido. |
| `migrations/BILLING_DUE_REMINDERS.sql` | Ajustes de calendario por empresa, exclusión por factura, cola idempotente, reintentos y purga. No guarda direcciones ni cuerpo; la RPC del emisor resuelve solo email, número, vencimiento y saldo actuales y revalida permisos/bajas/saldo. | Después de `BILLING_PAYMENTS_HISTORY.sql`, `BILLING_RECTIFYING_INVOICES.sql` y `COMPANY_MODULES.sql`; antes de desplegar el emisor y el panel actualizado. |
| `migrations/COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql` | Marca y plantillas de emails al cliente, RPC por empresa e historial/restauración de hasta diez revisiones. | Después de `BILLING_APPEARANCE.sql`, `COMPANY_MODULES.sql` y `BILLING_DUE_REMINDERS.sql`. |
| `migrations/BILLING_DUE_REMINDERS_CRON.sql` | Programa la llamada Edge cada 5 minutos y la purga diaria; URL y secreto se resuelven desde Vault. | Tras aplicar `BILLING_DUE_REMINDERS.sql` y desplegar `send-billing-due-reminders`: Edge Secrets `BILLING_REMINDERS_CRON_SECRET`, `RESEND_API_KEY`, `REMINDERS_FROM_EMAIL`; Vault `billing_due_reminders_cron_secret` (mismo valor que el secreto Edge) y `billing_due_reminders_function_url` (URL de la función); ejecutar este archivo al final. Ver `docs/setup-servicios-externos.md`. |
| `migrations/WEEKLY_SUMMARY_EMAIL.sql` | Cola única por compañía/semana, métricas agregadas, destinatarios administradores activos, reintentos y purga. | Después de tablas base de Analítica, Planning, CRM, `BILLING_PAYMENTS_HISTORY.sql`, Facturación, `BILLING_DUE_REMINDERS.sql` y `COMPANY_MODULES.sql`; después aplicar `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`. |
| `migrations/WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` | Activa el envío para empresas existentes y nuevas, fija lunes 09:00 Madrid y retira los ajustes por usuario/RPC. No hay pestaña ni opt-out del cliente. | Después de `WEEKLY_SUMMARY_EMAIL.sql`; antes del cron y el despliegue actualizado. |
| `migrations/WEEKLY_SUMMARY_EMAIL_CRON.sql` | Programa el worker cada 5 minutos los lunes y la purga diaria; URL y secreto salen de Vault. | Después de `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`, Edge deployment/secrets y dos entradas Vault; ver `docs/setup-servicios-externos.md`. |
| `migrations/BILLING_PAYMENTS_HISTORY.sql` | Cobros parciales/reversiones append-only, saldos e historial versionado de facturas y presupuestos. | Después de `BILLING_CHAPTER_TEMPLATES.sql`, antes de habilitar la fase 6 en el panel. |
| `migrations/BILLING_NAMED_PALETTES.sql` | Biblioteca de paletas con nombre por compañía, RLS y RPC de guardado validada/idempotente. | Después de `BILLING_APPEARANCE.sql`, antes de habilitar guardado de paletas con nombre. |
| `migrations/BILLING_APPEARANCE.sql` | Paletas por empresa/documento, contraste y firma de logos inline; conserva perfiles y documentos antiguos. | Después de `BILLING_SECURITY_HARDENING.sql` y `BILLING_DOCUMENT_PRESENTATION.sql`, antes de guardar nuevas paletas desde el panel. |
| `migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql` | Contrato de fecha de los avisos y repeticiones en hora de Madrid, incluido cambio de horario. | Tras la parte A de `PLANNING_REMINDERS.sql`, junto al redespliegue del emisor de emails. |
| `migrations/PLANNING_EMAIL_QUEUE.sql` | Cola de envío de Planning aislada por empresa, leases, deduplicación, reintentos limitados y conciliación si el proveedor aceptó el correo. No programa cron ni envía por sí misma. | Después de `PLANNING_REMINDER_PAYLOAD_FIX.sql` y antes de `COMPANY_MODULES.sql`; desplegar el Edge actualizado antes de habilitar la Parte B del cron de `PLANNING_REMINDERS.sql`. |
| `migrations/COMPANY_MEMBER_ACCESS.sql` | Bajas, reactivaciones y eliminación de vínculos; protección del último admin y acceso por empresa. | Antes de desplegar el panel y las funciones Edge actualizadas. |
| `migrations/BILLING_DOCUMENT_PRESENTATION.sql` | Validación de capítulos, detalles y presentación opcional del presupuesto. | Después de `BILLING_SECURITY_HARDENING.sql`. |
| `migrations/BILLING_SECURITY_HARDENING.sql` | Validación estricta de documentos, privilegios de RPC y versión de datos fiscales. | Después de `INVOICING.sql` y `QUOTES.sql`, junto al frontend actualizado. |
| `migrations/PLANNING_TENANT_HARDENING.sql` | Referencias de clientes al mismo tenant y tenant inmutable. | Tras revisar las referencias existentes con `maintenance/BILLING_SECURITY_AUDIT.sql` (§3). |
| `migrations/PLANNING_TASK_MOVE_UNDO.sql` | Versión de Planning, fin de tarea, registro de movimientos y RPC para deshacer el último movimiento. | Después de `PLANNING_TENANT_HARDENING.sql` y antes de `COMPANY_MODULES.sql`, que añade la policy y el trigger del módulo sobre `planning_task_moves`. |
| `migrations/PLANNING_STORAGE_HARDENING.sql` | Adjuntos privados por empresa, con compatibilidad de rutas antiguas. | Junto al frontend que incluye el ID de empresa en las rutas nuevas. |
| `migrations/QUOTES.sql` | Presupuestos, numeración propia y conversión atómica a factura. | Después de `INVOICING.sql`, antes de usar Presupuestos. |
| `migrations/INVOICING.sql` | Facturas, configuración por empresa, numeración atómica, permisos y control de cambios concurrentes. | Antes de utilizar la pestaña Facturación. |
| `migrations/RLS_ADMIN_WRITE_FIX.sql` | El rol `admin` de empresa también puede escribir. Antes solo podía `editor`. | Una vez, sobre una base de datos ya creada. |
| `migrations/PLANNING_TIMEZONE_FIX.sql` | Reinterpreta las tareas antiguas como hora de Madrid. | **Justo después** de desplegar el panel nuevo. |
| `migrations/PLANNING_REMINDERS.sql` | Recordatorios por email de Planning. | Parte A ya; parte B (el cron) cuando el dominio esté verificado en Resend. |
| `migrations/ANALYTICS_PRIVACY_UPGRADE.sql` | Visitantes anónimos con sal diaria, fuentes de tráfico e idioma. Sustituye el `session_id` que generaba el navegador. | Antes de desplegar el snippet nuevo en las webs. |
| `migrations/ANALYTICS_ENGAGEMENT.sql` | Scroll, tiempo en página, páginas 404 y las conversiones reservadas (teléfono, email, formulario). | Después de la anterior. **Luego vuelve a ejecutar `schema/ANALYTICS_AGGREGATION.sql`**: la función nueva rellena las columnas que crea esta migración. |

## Estado de identidad visual · 24/10/2026 [P3]

`BILLING_APPEARANCE.sql` ya estaba en el repositorio; P3 no modifica ninguna migración ni aplica SQL en entornos compartidos. Se ha validado localmente con PGlite, incluidos permisos negativos entre empresas, lector y membresía inactiva. Su estado en Supabase remoto no está comprobado.

Para desplegar, comprobar primero el backup y las migraciones existentes en destino. Validar la secuencia INVOICING → QUOTES → BILLING_SECURITY_HARDENING → BILLING_DOCUMENT_PRESENTATION → BILLING_APPEARANCE en desarrollo y usar el proceso CLI/CI autorizado para el entorno compartido. Desplegar después el panel. No requiere una función Edge nueva.

Smoke test en destino: guardar diseño de compañía, crear factura/presupuesto con copia propia, cambiar el predeterminado y verificar que los anteriores conservan logo/paleta; comprobar conversión y PDF; denegar lectura/escritura desde otra empresa, lector e inactivo. Una recuperación del frontend no debe eliminar datos guardados ni reescribir documentos. Contrato y límites en `docs/facturacion-datos.md`.

## Mantenimiento

**24/10/2026 [P7]:** nueva `migrations/BILLING_DRAFTS.sql`, después de `BILLING_APPEARANCE.sql`. Copias privadas, CAS, auditoría mínima y confirmación explícita idempotente en una transacción; autoguardar no consume números. Aplicada solo en PGlite, no en Supabase. Verificar backup/secuencia en desarrollo y desplegar por CLI/CI autorizado antes del panel. Sin Edge nuevas.

Pendiente programar diariamente `select public.purge_billing_recovery();` bajo propietario SQL/service_role: elimina copias caducadas (30 días), eventos >90 días y confirmaciones >30 días. La migración no programa cron ni guarda secretos. Sin job solo hay caducidad lógica por RLS/RPC. Procedimiento, rollback y smoke con dos empresas/usuarios en `docs/entornos.md`; contrato en `docs/facturacion-datos.md`. Verificar denegaciones, recarga, desconexión, conflicto y confirmación reintentada sin duplicado antes de producción.

**24/10/2026 [P5]:** `BILLING_NAMED_PALETTES.sql` es nueva y solo se ha aplicado en pruebas PostgreSQL locales (PGlite). No se ha ejecutado en Supabase. No modifica documentos ni perfiles existentes. Validar primero en desarrollo después de `BILLING_APPEARANCE.sql`; comprobar backup y desplegar mediante CLI/CI autorizado antes del frontend. No requiere funciones Edge nuevas. Smoke test: guardar, recargar, reutilizar desde Facturación/Presupuestos, reintentar la misma entrada sin duplicar, rechazar nombre repetido con otros colores y comprobar RLS con dos compañías, lector e inactivo. Contrato en `docs/facturacion-datos.md`.

**24/10/2026 [P12]:** aplicar `migrations/BILLING_ISSUED_INVOICE_LOCK.sql` antes de `migrations/BILLING_RECTIFYING_INVOICES.sql`. La segunda crea la serie rectificativa por empresa y la RPC de emisión inmutable. Validada localmente con PGlite; no ejecutada en Supabase. Antes de desplegar: backup, inventario de numeración `FR-*` usada manualmente y conciliación de facturas antiguas en estado `paid` sin cobros. Probar en desarrollo con dos empresas, repetición del mismo request, modos diferencias/sustitución, y lectores/usuarios de otra empresa. Desplegar base de datos antes que panel.

**24/10/2026 [P13]:** aplicar `migrations/PLANNING_TENANT_HARDENING.sql` antes de `migrations/PLANNING_TASK_MOVE_UNDO.sql`. La segunda añade versión optimista, fin de tarea, registro de movimiento y RPC de deshacer. Validada localmente con PGlite; no ejecutada en Supabase. Antes de desplegar: revisar duraciones/fechas existentes, backup, concurrencia y autorización entre empresas. Desplegar base de datos antes que panel; el movimiento de una repetición afecta a toda la serie y pide confirmación.

**26/10/2026 [P14, parcial]:** `migrations/PLANNING_EMAIL_QUEUE.sql` depende de `PLANNING_REMINDER_PAYLOAD_FIX.sql`. Esquema y RPC probados en PGlite; el Edge local se conecta a la cola con idempotencia del proveedor, y el panel añade lista/reintento según rol. Ninguna parte se ha desplegado en Supabase. Antes de activar: comprobar backup, aplicar migración, desplegar Edge, probar correo/idempotencia con buzón interno, configurar la purga diaria y habilitar el cron tras la verificación DNS/proveedor.

**26/10/2026 [Fase 5, módulos y búsqueda]:** `migrations/COMPANY_MODULES.sql` debe ir después de todas las tablas que gobiernan sus barreras. Se valida localmente con PGlite, incluido el apagado de lecturas y escrituras a través de `save_invoice`; no se ha aplicado en Supabase. La búsqueda global Ctrl+K está implementada localmente y respeta compañía/módulos. No desplegar el panel actualizado antes de aplicar y validar las migraciones pendientes en una copia de desarrollo.

| Fichero | Para qué |
|---|---|
| `maintenance/BILLING_SECURITY_AUDIT.sql` | Consultas de solo lectura para RLS, permisos, referencias, bucket y documentos inválidos. |
| `maintenance/CONTENT_SEO_FIELDS_AUDIT.sql` | Solo lectura: posts publicados sin slug válido y colisiones de slug por compañía; ejecutar después de `CONTENT_SEO_FIELDS.sql` y antes de habilitar las rutas públicas. |
| `maintenance/CRM_RETENTION_REVIEW_PREFLIGHT.sql` | Solo lectura y sin PII: verifica dependencias, trigger de enlace manual, tabla/RLS de retención y permisos RPC antes de aplicar las migraciones CRM nuevas. |
| `maintenance/BILLING_QUOTE_APPROVAL_PREFLIGHT.sql` | Solo lectura: comprueba tablas, columnas, trigger, RPC, RLS y permisos del circuito de aceptación de presupuestos sin mostrar datos de clientes. |
| `maintenance/COMPANY_CUSTOMER_EMAIL_TEMPLATES_PREFLIGHT.sql` | Solo lectura: comprueba tabla/RLS, denegación de acceso directo y permisos de las RPC para leer/guardar ajustes y renderizar emails. |
| `maintenance/DELETE_MOCK_CLIENT_COMPANIES.sql` | Borra las empresas cliente de prueba. **Destructivo**: ejecutar primero el paso 1, que solo consulta. |
| `maintenance/DELETE_COMPANIES.sql` | Borra empresas del panel y todo lo que cuelga de ellas. **Destructivo e irreversible**: ejecutar primero el paso 1. No borra los archivos de Storage. |

## Reglas

- **Ninguna clave dentro de un fichero de esta carpeta.** Los sitios donde hace
  falta una llevan `<PLACEHOLDER>`. Si necesitas una copia con los valores
  puestos, guárdala en `local/`, que está fuera de git.
- La service role key del cron se guarda en **Vault**, nunca dentro de
  `cron.schedule`: el comando del cron se guarda en claro en `cron.job` y lo
  puede leer cualquiera con acceso a la base de datos.
- Cuando cambies algo en Supabase a mano, refléjalo en `schema/`. Si no, estos
  ficheros dejan de servir para levantar el proyecto de cero.

## Actualización: gestión de miembros y plantillas documentales

1. Ejecutar `migrations/COMPANY_MEMBER_ACCESS.sql`. Los miembros existentes quedan activos; no elimina cuentas ni documentos.
2. Con `INVOICING.sql`, `QUOTES.sql` y `BILLING_SECURITY_HARDENING.sql` ya aplicados, ejecutar `migrations/BILLING_DOCUMENT_PRESENTATION.sql`.
3. Redesplegar `upload-item-media`, `delete-item-media`, `cambiar-rol-usuario` y `send-planning-reminders` (esta última conserva `--no-verify-jwt` y su secreto de cron). Después, desplegar el panel.

Las bajas se comprueban en los helpers de RLS y en las funciones con credenciales de servicio. La eliminación afecta exclusivamente a `company_members` para la empresa elegida. El trigger bloquea los cambios directos de rol, activación, identificadores y borrado desde clientes, incluso con policies antiguas permisivas. Las RPC serializan las operaciones por empresa y no permiten dejarla sin administrador activo. El propietario SQL y `service_role` conservan sus facultades de mantenimiento; nunca deben exponerse al cliente.

Las plantillas conservan los documentos antiguos. Los nuevos campos de presentación y capítulos son opcionales y se validan en JS y PostgreSQL. La conversión de presupuesto a factura conserva el contenido original. La vista previa dibuja los mismos elementos y páginas que la descarga PDF, sin depender de un plugin de navegador.

## Corrección de recordatorios y documentos

- Ejecutar `migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql` en instalaciones que ya envían avisos. Solo repara las funciones; conserva tareas, envíos registrados, cron y secretos. La parte A de `PLANNING_REMINDERS.sql` sigue siendo el requisito de una instalación inicial.
- Redesplegar `send-planning-reminders`: `supabase functions deploy send-planning-reminders --no-verify-jwt`. Incluye automáticamente `functions/_shared/planningReminder.ts`; conservar los secretos existentes.
- El emisor valida la ocurrencia antes de construir y enviar el correo. Para tareas antiguas sin repetición puede recuperar el inicio guardado; una repetición sin fecha válida se rechaza en vez de usar por error el inicio de toda la serie. Todos los accesos a tarea y cliente se limitan a la compañía, y se comprueba que el creador conserve una membresía activa.
- El panel incluye capítulos con múltiples partidas, descargas Blob desde el mismo gesto de usuario, borradores descargables, importes antes/después del descuento y una vista inicial de calendario 08:00–19:59 que se ajusta al espacio disponible. La vista de 24 horas sigue disponible, y se señala si hay tareas fuera del horario inicial.
- Vista local del correo, sin enviar mensajes: `output/previews/recordatorio-planning.html`. Los PDF de revisión usan datos ficticios.

**24/10/2026 [P8]:** nueva `migrations/BILLING_DIRECTORY_CATALOG.sql`, después de `BILLING_APPEARANCE.sql`. Amplía `client_company` sin modificar migraciones aplicadas y añade `billing_catalog_items`, archivo lógico, RLS y RPC de escritura autorizada. Aplicada solo en PGlite; antes del panel en destino, verificar backup, esquema real, migraciones pendientes y denegaciones entre compañías. Sin Edge nuevas.

**24/10/2026 [P9]:** nueva `migrations/BILLING_CHAPTER_TEMPLATES.sql`, después de `BILLING_DIRECTORY_CATALOG.sql`. Añade plantillas de capítulos por compañía, validación server-side, archivo lógico, RLS y RPC autorizadas. Aplicada solo en PGlite; verificar backup, secuencia, roles y documentos históricos antes de habilitar la UI en destino. Sin Edge nuevas.

**24/10/2026 [P10]:** nueva `migrations/BILLING_PAYMENTS_HISTORY.sql`, después de `BILLING_CHAPTER_TEMPLATES.sql`. Añade movimientos de cobro/reversión e historial append-only, RLS de lectura y RPC transaccionales para edición. Aplicada solo en PGlite; comprobar backup, concurrencia, reintentos, dos compañías y documentos históricos antes de habilitar la UI. No se ha desplegado ninguna Edge Function ni migración.

**24/10/2026 [P11]:** nueva `migrations/BILLING_ISSUED_INVOICE_LOCK.sql`, después de `BILLING_PAYMENTS_HISTORY.sql`. Mantiene inmutable el contenido de facturas emitidas/pagadas y reserva el estado pagado para las RPC de cobro. Aplicada solo en PGlite; antes de desplegar, revisar en una copia de desarrollo la compatibilidad con integraciones que llamen directamente a `save_invoice`. No habilitar el cambio de frontend sin aplicar y validar el contrato SQL. Sin Edge nuevas.
