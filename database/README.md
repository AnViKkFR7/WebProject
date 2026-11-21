# Base de datos

Fuentes SQL del proyecto. Para una instalación nueva, usar el bootstrap verificable descrito abajo; para bases existentes, contrastar historial y aplicar solo cambios pendientes mediante el proceso de despliegue autorizado.

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

La fuente canónica es `bootstrap/manifest.json`. Generar con `npm run db:bootstrap` y revisar `database/local/bootstrap.generated.sql` antes de aplicar con psql sobre un proyecto Supabase nuevo. El comando solo genera un archivo; no conecta ni ejecuta SQL. No sobrescribe salidas existentes. Procedimiento, requisitos y límites en [docs/bootstrap-supabase.md](../docs/bootstrap-supabase.md).

El bootstrap exige PostgreSQL 15+, Auth/Storage y roles de Supabase ya inicializados y el esquema público de aplicación vacío. No reconstruye la plataforma Supabase ni modifica migraciones ya aplicadas. La prueba local usa solo un contrato simulado de plataforma y ejecuta todas las fuentes siguientes:

1. `bootstrap/PREFLIGHT.sql`.
2. `schema/DB_SCHEMA.sql`.
3. `bootstrap/PLANNING_BASE.sql`.
4. `schema/ITEM_MEDIA_STORAGE.sql`.
5. `schema/USER_FILTER_PREFERENCES.sql`.
6. `schema/ANALYTICS_SCHEMA.sql`.
7. `schema/PLANNING_SCHEMA.sql`.
8. `schema/ATTRIBUTES_SCHEMA.sql`.
9. `schema/LEADS_SCHEMA.sql`.
10. `migrations/ANALYTICS_PRIVACY_UPGRADE.sql`.
11. `migrations/ANALYTICS_ENGAGEMENT.sql`.
12. `schema/ANALYTICS_AGGREGATION.sql` — solo funciones, sin extensión ni cron.
13. `migrations/CONTENT_SEO_FIELDS.sql`.
14. `migrations/COMPANY_MEMBER_ACCESS.sql`.
15. `migrations/RLS_ADMIN_WRITE_FIX.sql`.
16. `migrations/PLANNING_TENANT_HARDENING.sql`.
17. `migrations/PLANNING_TASK_MOVE_UNDO.sql`.
18. `migrations/PLANNING_REMINDERS.sql` — Parte A solamente.
19. `migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql`.
20. `migrations/PLANNING_EMAIL_QUEUE.sql`.
21. `bootstrap/STORAGE_BUCKETS.sql`.
22. `migrations/PLANNING_STORAGE_HARDENING.sql`.
23. `migrations/CRM_CONTACTS_PIPELINE.sql`.
24. `migrations/CRM_LEAD_ITEM_ATTRIBUTION.sql`.
25. `migrations/CRM_REVIEW_ACTIVITY_LINK.sql`.
26. `migrations/CRM_PRIVACY_CONTROLS.sql`.
27. `migrations/INVOICING.sql`.
28. `migrations/QUOTES.sql`.
29. `migrations/BILLING_SECURITY_HARDENING.sql`.
30. `migrations/BILLING_DOCUMENT_PRESENTATION.sql`.
31. `migrations/BILLING_APPEARANCE.sql`.
32. `migrations/BILLING_DRAFTS.sql`.
33. `migrations/BILLING_NAMED_PALETTES.sql`.
34. `migrations/BILLING_DIRECTORY_CATALOG.sql`.
35. `migrations/BILLING_CHAPTER_TEMPLATES.sql`.
36. `migrations/BILLING_PAYMENTS_HISTORY.sql`.
37. `migrations/BILLING_ISSUED_INVOICE_LOCK.sql`.
38. `migrations/BILLING_RECTIFYING_INVOICES.sql`.
39. `migrations/BILLING_QUOTE_APPROVAL.sql`.
40. `migrations/BILLING_QUOTE_APPROVAL_REVISIONS.sql`.
41. `migrations/BILLING_QUOTE_APPROVAL_DASHBOARD_HANDLING.sql`.
42. `migrations/CRM_BILLING_LINKS.sql`.
43. `migrations/CRM_PRIVACY_ANONYMIZATION_FIX.sql`.
44. `migrations/CRM_RETENTION_REVIEW.sql`.
45. `migrations/COMPANY_MODULES.sql`.
46. `migrations/COMPANY_MODULES_PLATFORM_ADMIN.sql`.
47. `migrations/BILLING_DUE_REMINDERS.sql`.
48. `migrations/COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql`.
49. `migrations/COMPANY_CUSTOMER_EMAIL_REVISIONS_REPAIR.sql`.
50. `migrations/COMPANY_MODULES_SCOPE_FIX.sql`.
51. `migrations/WEEKLY_SUMMARY_EMAIL.sql`.
52. `migrations/WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`.
53. `migrations/ITEM_MEDIA_COVER_SECURITY.sql`.
54. `migrations/ITEM_MEDIA_SUMMARY_SECURITY.sql`.
55. `migrations/ANALYTICS_RPC_SECURITY.sql`.
56. `migrations/COMPANY_MODULES_RPC_COMPLETION.sql`.
57. `migrations/BILLING_RECTIFICATION_BALANCES.sql`.
58. `migrations/BILLING_PROFILE_VALIDATION_REPAIR.sql`.
59. `migrations/PUBLIC_LEAD_RATE_LIMIT.sql` — sin el bloque opcional de programación de purga.
60. `migrations/PLANNING_RECURRENCE_WINDOW.sql`.
61. `migrations/PLANNING_EMAIL_STALE_GUARD.sql`.
62. `migrations/WEEKLY_SUMMARY_RETRY_WINDOW.sql`.
63. `migrations/CLIENT_DIRECTORY_MODULE_ACCESS.sql`.
64. `migrations/ITEM_STORAGE_CLEANUP_QUEUE.sql`.
65. `migrations/WEEKLY_SUMMARY_METRICS.sql`.
66. `migrations/CRM_PRIVACY_SEARCH_LITERAL.sql`.
67. `migrations/COMPANY_USER_INVITATION_STATE.sql`.
68. `migrations/COMPANY_USER_PROVISIONING_RECOVERY.sql`.
69. `migrations/BLOG_MEDIA_EDITOR.sql`.
70. `migrations/ITEM_MEDIA_PUBLIC_READ_FIX.sql`.
71. `bootstrap/FINAL_ACCESS.sql`.

La inicialización de Planning aporta las cinco tablas ausentes en el esquema base. `attached_file` y `client_company_members` se conservan como compatibilidad histórica, con RLS y sin acceso de navegador: no son una vía alternativa de permisos. El cierre del bootstrap concede privilegios explícitos, mantiene escrituras sensibles por RPC y no concede TRUNCATE a anon/authenticated.

Fuera de la instalación automática:

- `migrations/PLANNING_TIMEZONE_FIX.sql`: reparación histórica con fecha de despliegue; no aplica a una base vacía.
- `migrations/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql`, `migrations/WEEKLY_SUMMARY_EMAIL_WATCH_TEST_FIX.sql`, `migrations/WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql` y `migrations/WEEKLY_SUMMARY_EMAIL_WATCH_RESEND.sql`: circuito opcional de pruebas manuales; no crea ni envía un test durante el bootstrap. La definición final normal del payload procede de `WEEKLY_SUMMARY_RETRY_WINDOW.sql` y conserva el cast varchar→text[].
- Los cron van al final, después de desplegar Edge y configurar secretos/Vault. Para Planning, desplegar `send-planning-reminders` antes de aplicar la **Parte B** de `migrations/PLANNING_REMINDERS.sql`. Los otros activadores son `migrations/BILLING_DUE_REMINDERS_CRON.sql`, `migrations/WEEKLY_SUMMARY_EMAIL_CRON.sql` y `migrations/ITEM_STORAGE_CLEANUP_CRON.sql`. Analítica y purga de límites de leads se activan por separado según el documento del bootstrap.
- `maintenance/`, `local/` y `schema/BDD_REFERENCIA.sql` nunca forman parte de la instalación automática. Revisar cada operación según el entorno; no ejecutar snapshots, demos ni limpiezas por reconstruir la aplicación.

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
| `migrations/CRM_PRIVACY_ANONYMIZATION_FIX.sql` | Corrige la RPC de anonimización para borrar también `source_item` de las solicitudes CRM; conserva sus permisos, idempotencia, auditoría minimizada y documentos fiscales. | Después de `CRM_LEAD_ITEM_ATTRIBUTION.sql` y `CRM_BILLING_LINKS.sql`; antes de `COMPANY_MODULES.sql`. Ejecutar una vez y luego la revisión de retención. |
| `maintenance/CRM_PRIVACY_ANONYMIZATION_PREFLIGHT.sql` | Comprueba la presencia de la RPC, su configuración de seguridad, que su definición limpia `source_item` y sus permisos esperados; no devuelve PII ni modifica datos. | Después de `CRM_PRIVACY_ANONYMIZATION_FIX.sql`; las cuatro columnas deben devolver `true`. |
| `migrations/CRM_RETENTION_REVIEW.sql` | Plazos de revisión configurables por empresa para solicitudes sin vincular y contactos inactivos; muestra solo conteos y no borra datos. | Después de `CRM_PRIVACY_CONTROLS.sql` y `CRM_BILLING_LINKS.sql`; antes de `COMPANY_MODULES.sql`. |
| `migrations/BILLING_QUOTE_APPROVAL.sql` | Enlaces privados de un solo uso, vencimiento, aceptación/rechazo registrado y trazabilidad de identidad declarada. | Después de `QUOTES.sql`; antes de `COMPANY_MODULES.sql`. |
| `migrations/BILLING_QUOTE_APPROVAL_REVISIONS.sql` | Permite una nueva respuesta al reemitir un enlace tras modificar un presupuesto rechazado, conserva el historial inmutable y devuelve estado/versión actuales para refresco del panel. | Después de `BILLING_QUOTE_APPROVAL.sql`; antes de `COMPANY_MODULES.sql`. |
| `migrations/BILLING_QUOTE_APPROVAL_DASHBOARD_HANDLING.sql` | Añade el estado leído/tratado por usuario para respuestas recientes del dashboard; conserva inmutable la respuesta del cliente y oculta solo la fila tratada a ese usuario. | Después de `BILLING_QUOTE_APPROVAL_REVISIONS.sql`; antes de desplegar el panel actualizado. |
| `migrations/COMPANY_MODULES.sql` | Preferencias por empresa, todos activos por defecto y barreras RLS/triggers para lecturas y escrituras directas o por RPC; desactiva la cola de avisos de Planning al apagar ese módulo. | Después de `PLANNING_TASK_MOVE_UNDO.sql`, CRM, `CRM_PRIVACY_CONTROLS.sql`, `CRM_BILLING_LINKS.sql`, `CRM_RETENTION_REVIEW.sql`, `PLANNING_EMAIL_QUEUE.sql`, analítica, `INVOICING.sql`, `QUOTES.sql`, `BILLING_QUOTE_APPROVAL.sql` y todas las migraciones que crean tablas de facturación existentes. Después aplicar `COMPANY_MODULES_PLATFORM_ADMIN.sql`. |
| `migrations/COMPANY_MODULES_PLATFORM_ADMIN.sql` | Solo el administrador del sistema puede cambiar la configuración mediante RPC; los miembros conservan lectura de los módulos activos que necesita el panel. Revoca `UPDATE` directo. | Después de `COMPANY_MODULES.sql` y antes de la versión del panel con el menú de módulos restringido. |
| `migrations/COMPANY_MODULES_SCOPE_FIX.sql` | Añade el control del módulo Facturación a los RPC de plantillas de email, auditoría de aprobación y notificación posterior, conservando comprobaciones de rol y payloads. | Después de `COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql`, `BILLING_QUOTE_APPROVAL_REVISIONS.sql` y `BILLING_QUOTE_APPROVAL_DASHBOARD_HANDLING.sql`. Luego ejecutar su preflight. No cambia grants directos de tablas ni modifica Edge Functions. |
| `maintenance/COMPANY_MODULES_SCOPE_FIX_PREFLIGHT.sql` | Comprueba las barreras de módulo, permisos de RPC y acceso directo a tablas privadas; solo devuelve booleanos. | Después de `COMPANY_MODULES_SCOPE_FIX.sql`; todas las columnas deben ser `true`. |
| `migrations/BILLING_DUE_REMINDERS.sql` | Ajustes de calendario por empresa, exclusión por factura, cola idempotente, reintentos y purga. No guarda direcciones ni cuerpo; la RPC del emisor resuelve solo email, número, vencimiento y saldo actuales y revalida permisos/bajas/saldo. | Después de `BILLING_PAYMENTS_HISTORY.sql`, `BILLING_RECTIFYING_INVOICES.sql` y `COMPANY_MODULES.sql`; antes de desplegar el emisor y el panel actualizado. |
| `migrations/COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql` | Marca y plantillas de emails al cliente, RPC por empresa e historial/restauración de hasta diez revisiones. | Después de `BILLING_APPEARANCE.sql`, `COMPANY_MODULES.sql` y `BILLING_DUE_REMINDERS.sql`. |
| `migrations/COMPANY_CUSTOMER_EMAIL_REVISIONS_REPAIR.sql` | Restaura la tabla de historial de plantillas y sus permisos si faltó por una ejecución interrumpida de la migración de emails. | Solo si `maintenance/COMPANY_CUSTOMER_EMAIL_TEMPLATES_PREFLIGHT.sql` informa `revisions_table_exists=false`; después de `COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql` y antes de `COMPANY_MODULES_SCOPE_FIX.sql`. |
| `migrations/BILLING_DUE_REMINDERS_CRON.sql` | Programa la llamada Edge cada 5 minutos y la purga diaria; URL y secreto se resuelven desde Vault. | Tras aplicar `BILLING_DUE_REMINDERS.sql` y desplegar `send-billing-due-reminders`: Edge Secrets `BILLING_REMINDERS_CRON_SECRET`, `RESEND_API_KEY`, `REMINDERS_FROM_EMAIL`; Vault `billing_due_reminders_cron_secret` (mismo valor que el secreto Edge) y `billing_due_reminders_function_url` (URL de la función); ejecutar este archivo al final. Ver `docs/setup-servicios-externos.md`. |
| `migrations/WEEKLY_SUMMARY_EMAIL.sql` | Cola única por compañía/semana, métricas agregadas, destinatarios administradores activos, reintentos y purga. | Después de tablas base de Analítica, Planning, CRM, `BILLING_PAYMENTS_HISTORY.sql`, Facturación, `BILLING_DUE_REMINDERS.sql` y `COMPANY_MODULES.sql`; después aplicar `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`. |
| `migrations/WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` | Activa el envío para empresas existentes y nuevas, fija lunes 09:00 Madrid y retira los ajustes por usuario/RPC. No hay pestaña ni opt-out del cliente. | Después de `WEEKLY_SUMMARY_EMAIL.sql`; antes del cron y el despliegue actualizado. |
| `migrations/WEEKLY_SUMMARY_EMAIL_CRON.sql` | Programa el worker cada 5 minutos los lunes y la purga diaria; URL y secreto salen de Vault. | Después de `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`, Edge deployment/secrets y dos entradas Vault; ver `docs/setup-servicios-externos.md`. |
| `migrations/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql` | Crea una ejecución aislada y de un solo uso para validar el email del resumen en `WatchEcommerceDemo`; nunca toca la cola normal. | Después de `WEEKLY_SUMMARY_EMAIL.sql` y `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`; luego desplegar la Edge Function actualizada antes de activar `maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql`. |
| `migrations/WEEKLY_SUMMARY_EMAIL_WATCH_TEST_FIX.sql` | Corrige el target ambiguo de `ON CONFLICT` en el RPC de la prueba aislada; no modifica datos. | Después de `WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql` si ya se aplicó la primera versión; antes de volver a pedir la prueba. |
| `migrations/WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql` | Convierte emails Supabase `varchar` a `text[]` en los payloads normal y de prueba; habilita una sola recuperación manual del test fallido en menos de 20 horas, con el mismo ID y clave Resend. | Después de `WEEKLY_SUMMARY_EMAIL_WATCH_TEST_FIX.sql`; después ejecutar una vez el contenido actualizado de `maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql`. No requiere redesplegar Edge. |
| `migrations/WEEKLY_SUMMARY_RETRY_WINDOW.sql` | Recuperación del resumen normal dentro de 20 horas desde un primer intento fijo, lease de 10 minutos y validación final de servicio. Conserva confirmaciones y retira intentos inciertos antiguos. | Después de las migraciones del resumen y de `WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql` cuando esté instalada; nunca reaplicar después los cuerpos antiguos. Pausar cron, esperar workers y desplegar SQL/Edge coordinados; ver `docs/weekly-summary-retry-window.md`. No activa la prueba Watch. |
| `maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql` | Envía una petición autenticada a Edge usando secretos ya existentes en Vault; no muestra ni copia secretos. | Ejecutar una vez, después de la migración aislada y del despliegue de `send-weekly-summary`. Ver `docs/setup-servicios-externos.md`. |
| `migrations/WEEKLY_SUMMARY_EMAIL_WATCH_RESEND.sql` | Autoriza exactamente un envío adicional aislado tras la prueba anterior exitosa, con clave propia por solicitud; bloquea reintentos de transporte duplicados. | Después de las tres migraciones WATCH_TEST/FIX/DELIVERY_FIX; desplegar `send-weekly-summary` actualizado y ejecutar una vez `maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql`. No afecta a la cola normal. |
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
| `migrations/BLOG_MEDIA_EDITOR.sql` | Imágenes del blog (hasta 3 por artículo): bucket `blog-media` con límite de 5 MB, permisos de Storage por empresa/rol/módulo y validación de `blog_media`. | Antes de desplegar el panel con el editor de blog nuevo. |
| `migrations/ITEM_MEDIA_PUBLIC_READ_FIX.sql` | Auditoría de seguridad (endurecimiento): quita la política abierta `item_media_public_select` (`using(true)`). Hoy no se explota porque el filtro de módulos oculta los borradores ajenos, pero la protección dependía de ese efecto colateral. Las webs y el panel siguen igual. | Cuando convenga; no depende de ningún despliegue del panel. |
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

## Seguridad de portadas · auditoría, entrega 2

Aplicar `migrations/ITEM_MEDIA_COVER_SECURITY.sql` después de `schema/ITEM_MEDIA_STORAGE.sql`, `migrations/COMPANY_MEMBER_ACCESS.sql` y `migrations/COMPANY_MODULES.sql`. Sustituye la RPC conservando su firma: exige autenticación, admin/editor activo o administrador de plataforma, módulo items habilitado e imagen del mismo item. Revoca ejecución pública/anónima. No volver a ejecutar después el esquema antiguo de media: restauraría la función insegura. No requiere redesplegar frontend ni Edge.

Antes de producción, verificar las dependencias y el historial real. Aplicar la migración una vez en un entorno controlado y comprobar cambio autorizado, denegación anónima, usuario de otra empresa y media de otro item. Las pruebas locales no acreditan su aplicación remota.

## Seguridad del resumen de media · auditoría, entrega 3

Aplicar `migrations/ITEM_MEDIA_SUMMARY_SECURITY.sql` después de `schema/ITEM_MEDIA_STORAGE.sql`, `migrations/COMPANY_MEMBER_ACCESS.sql` y `migrations/COMPANY_MODULES.sql`, en PostgreSQL 15 o superior. Comprobar antes que `items` e `item_media` tienen RLS habilitado, las policies base y las restricciones de módulo instaladas, y SELECT de las tablas para anon/authenticated. La vista usa las RLS del invocador; conserva columnas y tipos. Se revocan permisos generales de la vista y se concede solo SELECT a anon/authenticated. No requiere despliegue de frontend ni Edge.

Verificación de solo lectura posterior: `select reloptions from pg_class where oid='public.item_media_summary'::regclass;` debe incluir `security_invoker=true`. Contrastar como anónimo publicados frente a borradores y como miembro de cada empresa con sus permisos reales. No considerar validación una consulta hecha solo con el propietario o service_role. No volver a ejecutar esquemas anteriores sin revisar que conservan las correcciones posteriores.

## RPC de analítica · auditoría, entrega 4

Aplicar `migrations/ANALYTICS_RPC_SECURITY.sql` después de la última ejecución de `schema/ANALYTICS_AGGREGATION.sql`, `migrations/RLS_ADMIN_WRITE_FIX.sql`, `migrations/COMPANY_MEMBER_ACCESS.sql` y `migrations/COMPANY_MODULES.sql`. No requiere despliegue del panel ni de Edge. Mantiene firmas, cálculo, retención y horarios existentes. La agregación y purga quedan disponibles al propietario y service_role; la RPC del botón solo a authenticated y comprueba autorización, empresa y módulo. No volver a aplicar las definiciones antiguas sin conservar esta corrección.

Antes de aplicar, revisar `select jobname, username, command from cron.job where jobname in ('aggregate-analytics-daily','aggregate-analytics-intraday','purge-analytics-events');`. El usuario real del cron debe ser el propietario o disponer de EXECUTE explícito: contrastar con `has_function_privilege(username,'public.aggregate_analytics_rollup(date,uuid)','EXECUTE')` y su equivalente para `public.purge_old_analytics_events()`. Si usa un rol técnico distinto, revisar y conceder solo lo necesario a ese rol; no devolver EXECUTE a public/anon/authenticated.

Validar como anónimo y usuario autenticado que las RPC internas deniegan ejecución; comprobar que el botón autorizado solo actualiza la empresa solicitada, bloquea viewers/bajas/módulos desactivados, y que los jobs conservan ejecuciones exitosas. Las pruebas locales ejecutan el SQL real, sin scheduler remoto.

## Bloqueos de módulos RPC · auditoría, entrega 6

Aplicar `migrations/COMPANY_MODULES_RPC_COMPLETION.sql` al final de las migraciones de negocio y después de `COMPANY_MODULES_SCOPE_FIX.sql`. Requiere Facturación completa (rectificativas, borradores y recordatorios), CRM con privacidad/vínculos/retención, `PLANNING_EMAIL_QUEUE.sql`, `PLANNING_STORAGE_HARDENING.sql` y `COMPANY_MEMBER_ACCESS.sql`. No cambiar migraciones aplicadas ni repetir definiciones antiguas tras esta corrección. No requiere despliegue de frontend/Edge. Inventario y pruebas en `docs/auditoria-modulos-rpc.md`.

Comprobar desactivación y reactivación de billing/crm/planning con editor, viewer, miembro ajeno y administrador de plataforma. Confirmar que la exportación CRM señala `billing_module_enabled=false` y omite documentos de billing desactivado. Verificar objetos Planning canónicos y de legado con los permisos reales de Storage. No hay aplicación remota realizada desde esta entrega.

## Saldos de rectificativas · auditoría, entrega 7

Aplicar `migrations/BILLING_RECTIFICATION_BALANCES.sql` después de `COMPANY_MODULES_RPC_COMPLETION.sql` y `BILLING_DUE_REMINDERS.sql`; después publicar el panel actualizado. No volver a ejecutar definiciones anteriores que sustituyan funciones corregidas. No requiere despliegue Edge ni genera emails por sí misma.

Revisar primero familias existentes, fechas/secuencias de documentos heredados y saldos previstos. Ver reglas, pruebas y límites en `docs/rectificativas-saldos.md`. Probar dos empresas, cobros/reversiones, exclusión de avisos antiguos, jobs con saldo nuevo y coste con volumen representativo. Pendiente validación concurrente real; PGlite no sustituye varias sesiones remotas.

## Escenario ficticio para el manual de WatchEcommerceDemo

`maintenance/WATCH_MANUAL_DEMO_DATA.sql` añade exclusivamente datos ficticios de la empresa de pruebas: CRM/solicitudes, Planning/previsiones, documentos/cobros, catálogo, blog y 30 días de analítica. Es una operación de datos repetible, no una migración. El usuario autorizó poblar esta empresa para sustituir las capturas del manual sin ocultaciones. No modifica otras empresas ni permisos, no envía emails y excluye los documentos nuevos de avisos. Ejecutar el archivo completo en SQL Editor y comprobar la fila final (12 solicitudes, 8 contactos, 10 tareas, 4 presupuestos, 5 facturas y 30 días). Guía y comprobaciones: `docs/manual-demo-data.md`. Carga remota y nueva edición del PDF pendientes de confirmación.

## Validación de identidad visual · auditoría, entrega 8

Aplicar `migrations/BILLING_PROFILE_VALIDATION_REPAIR.sql` después de `BILLING_APPEARANCE.sql`, `BILLING_RECTIFYING_INVOICES.sql` y las correcciones de módulos/saldos. No volver a aplicar después las definiciones antiguas de validate_billing_profile, que perderían la validación acumulativa. No requiere publicar frontend ni Edge.

Restaura validación de paleta/contraste y codificación/firma de logos, y conserva rectificationPrefix. La comprobación de firma no equivale a decodificar y validar íntegramente una imagen. No reescribe perfiles/documentos heredados: los inválidos se pueden seguir consultando, pero deben corregirse antes de volver a guardarlos o reutilizarlos en nuevas emisiones. En entorno controlado probar perfil válido con PNG/JPEG, perfil antiguo sin paleta, paleta sin contraste, tipo de logo manipulado y serie inválida; comprobar tanto perfiles como facturas/presupuestos y rectificativas. Revisar los valores existentes antes de producción.

Pruebas: `npm test -- tests/database/billingProfileValidationRepair.test.js tests/database/billingAppearance.test.js tests/database/billingNamedPalettes.test.js tests/database/billingRectifyingInvoices.test.js tests/database/billingRectificationBalances.test.js`. Siete pruebas nuevas y 28 en total pasan; la cadena de prueba aplica la redefinición vulnerable antes de la reparación para detectar regresiones del orden de migraciones.

## Cuotas públicas de leads · auditoría, entrega 11

Aplicar `migrations/PUBLIC_LEAD_RATE_LIMIT.sql` después de LEADS_SCHEMA y COMPANY_MODULES. Crea buckets aislados, sin lectura/escritura directa para anon/authenticated/service_role y con reserva/purga ejecutables únicamente por service_role o propietario. La reserva serializa el control por empresa y vuelve a comprobar CRM. No modifica leads existentes.

Antes de redesplegar los endpoints de cada web, añadir secreto de servidor y verificar la RPC. Comprobar el job pg_cron `purge-public-lead-rate-buckets`; si no hay pg_cron, proporcionar un ejecutor horario de `purge_public_lead_rate_buckets`. Conservar y verificar la cabecera del proxy de confianza Vercel. Reglas, límites, privacidad, mensajes y orden: `company-site-snippet/LEADS_INTEGRATION.md`, sección de protección contra spam. Pendiente validación concurrente y de retención/cron en entorno controlado.

## Recurrencias por intervalo · auditoría, entrega 12

Aplicar `migrations/PLANNING_RECURRENCE_WINDOW.sql` después de PLANNING_REMINDER_PAYLOAD_FIX y COMPANY_MODULES. Conserva el contrato de due_planning_reminders y su ejecución restringida a service_role; no requiere Edge ni cambios de cron. Publicar también el panel con expansión por intervalo. No aplicar después definiciones antiguas de esa función.

La migración no envía correos, pero el cron activo podrá empezar a encolar ocurrencias actuales de series antiguas antes truncadas: revisar volumen y series activas en entorno controlado antes de producción. Ver `docs/recurrencias-por-intervalo.md` para reglas de Madrid/DST, límites, fechas sin hora, importes por periodo y pruebas.

## Avisos obsoletos de Planning · auditoría, entrega 13

Aplicar `migrations/PLANNING_EMAIL_STALE_GUARD.sql` después de PLANNING_TASK_MOVE_UNDO, PLANNING_EMAIL_QUEUE, PLANNING_RECURRENCE_WINDOW y COMPANY_MODULES_RPC_COMPLETION. Requiere desplegar el worker `send-planning-reminders` actualizado. Pausar el scheduler y esperar a workers en vuelo antes de la migración y despliegue; reanudar solo tras verificar ambas versiones. No requiere frontend.

La migración marca como inciertos (dead/sent_marker_failed) los intentos antiguos queued/sending ya intentados: revisar y conciliar; no autoriza reenviarlos. Añade versión al encolado, invalidación al editar, control final y preservación de confirmación tardía. La comprobación no puede retirar correos ya aceptados por el proveedor. Ver pruebas, orden operativo y límites en `docs/planning-avisos-obsoletos.md`. Sin aplicación remota realizada.


### Auditoría · entrega 15: directorio compartido

`migrations/CLIENT_DIRECTORY_MODULE_ACCESS.sql` unifica RLS, trigger y RPC de `client_company`: Planning o Facturación habilitado, con rol y empresa autorizados. Revoca acceso directo salvo SELECT para authenticated; no amplía tareas, archivos ni catálogo. Aplicar después de `BILLING_DIRECTORY_CATALOG.sql`, `PLANNING_TENANT_HARDENING.sql`, `COMPANY_MEMBER_ACCESS.sql`, `COMPANY_MODULES.sql` y `COMPANY_MODULES_RPC_COMPLETION.sql`. No reaplicar después los cuerpos antiguos de directorio o módulos. Publicar también el panel para alinear ruta, menú y enlaces.

44 pruebas locales en siete archivos, lint y build correctos. SQL y permisos remotos pendientes de comprobar con dos empresas; matriz y procedimiento en `docs/directorio-clientes-compartido.md`. No requiere despliegue de Edge, Storage ni cron.


### Auditoría · entrega 16: limpieza de Storage de items

Aplicar `migrations/ITEM_STORAGE_CLEANUP_QUEUE.sql` después de las tablas base de items/blog, `ITEM_MEDIA_STORAGE.sql`, membresías activas y módulos. Instala cola y respaldo privados, captura transaccional, validación de referencias y tombstones; no elimina bytes mediante SQL. Desplegar `delete-item-media` y el nuevo `cleanup-item-media` durante una pausa de operaciones, configurar su secreto exclusivo y después aplicar `migrations/ITEM_STORAGE_CLEANUP_CRON.sql` con Vault/pg_cron/pg_net disponibles. No reaplicar después el placeholder de limpieza anterior.

36 pruebas locales y compilación 14/14 funciones. Despliegue y concurrencia remotos pendientes; no borra objetos históricos a ciegas. Ver `docs/limpieza-storage-items.md` para fuentes de referencias, revisión, retención de marcadores y pasos de despliegue.


### Auditoría · entregas 18–21

Las nuevas migraciones `WEEKLY_SUMMARY_METRICS.sql`, `CRM_PRIVACY_SEARCH_LITERAL.sql` y `COMPANY_USER_INVITATION_STATE.sql` corrigen los conteos semanales, la búsqueda literal de privacidad y el estado privado de invitaciones. El orden canónico y manifiesto incluyen ahora 68 pasos. No modifican migraciones anteriores ni envían correos mediante SQL. Requieren despliegue coordinado de Edge/panel según `docs/auditoria-cierre-18-21.md`; permisos, SMTP, concurrencia y despliegue remotos pendientes.
