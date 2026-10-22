# Base de datos

Todo el SQL del proyecto. Se ejecuta pegándolo en el **SQL Editor de Supabase**.

| Carpeta | Qué contiene |
|---|---|
| `schema/` | Cómo está montada la base de datos. Es la referencia: si algo cambia en Supabase, se actualiza aquí. |
| `migrations/` | Cambios puntuales sobre una base de datos que ya existe. Se ejecutan una vez. |
| `maintenance/` | Limpiezas y arreglos de datos. Se ejecutan cuando hacen falta. |
| `local/` | **No va a git.** Para tus copias con valores reales (claves, ids). |

Todos los ficheros son idempotentes salvo los de `maintenance/`: se pueden
volver a ejecutar sin romper nada.

## Orden de ejecución en una base de datos nueva

1. `schema/DB_SCHEMA.sql` — tablas principales, helpers de permisos y RLS.
2. `schema/ITEM_MEDIA_STORAGE.sql` — imágenes y PDFs de los items.
3. `schema/USER_FILTER_PREFERENCES.sql` — filtros guardados por usuario.
4. `schema/ANALYTICS_SCHEMA.sql` — eventos y tabla diaria de analítica.
5. `schema/ANALYTICS_AGGREGATION.sql` — agregación por cron y botón "Actualizar ahora".
6. `schema/PLANNING_SCHEMA.sql` — RLS de empresas cliente, tareas y facturación.
7. `schema/ATTRIBUTES_SCHEMA.sql` — orden de los atributos y listas de opciones.
8. `schema/LEADS_SCHEMA.sql` — bandeja de solicitudes de las webs.

**Las migraciones de analítica no están dobladas dentro de `schema/`.** En una
base de datos nueva, después de los ocho ficheros de arriba ejecuta, por este
orden: `migrations/ANALYTICS_PRIVACY_UPGRADE.sql`, `migrations/ANALYTICS_ENGAGEMENT.sql`
y otra vez `schema/ANALYTICS_AGGREGATION.sql`.

`schema/BDD_REFERENCIA.sql` no se ejecuta: es un volcado de la estructura real,
útil para consultar tipos y claves ajenas.

## Migraciones

| Fichero | Para qué | Cuándo |
|---|---|---|
| `migrations/PLANNING_REMINDER_PAYLOAD_FIX.sql` | Contrato de fecha de los avisos y repeticiones en hora de Madrid, incluido cambio de horario. | Tras la parte A de `PLANNING_REMINDERS.sql`, junto al redespliegue del emisor de emails. |
| `migrations/COMPANY_MEMBER_ACCESS.sql` | Bajas, reactivaciones y eliminación de vínculos; protección del último admin y acceso por empresa. | Antes de desplegar el panel y las funciones Edge actualizadas. |
| `migrations/BILLING_DOCUMENT_PRESENTATION.sql` | Validación de capítulos, detalles y presentación opcional del presupuesto. | Después de `BILLING_SECURITY_HARDENING.sql`. |
| `migrations/BILLING_SECURITY_HARDENING.sql` | Validación estricta de documentos, privilegios de RPC y versión de datos fiscales. | Después de `INVOICING.sql` y `QUOTES.sql`, junto al frontend actualizado. |
| `migrations/PLANNING_TENANT_HARDENING.sql` | Referencias de clientes al mismo tenant y tenant inmutable. | Tras revisar las referencias existentes con `maintenance/BILLING_SECURITY_AUDIT.sql` (§3). |
| `migrations/PLANNING_STORAGE_HARDENING.sql` | Adjuntos privados por empresa, con compatibilidad de rutas antiguas. | Junto al frontend que incluye el ID de empresa en las rutas nuevas. |
| `migrations/QUOTES.sql` | Presupuestos, numeración propia y conversión atómica a factura. | Después de `INVOICING.sql`, antes de usar Presupuestos. |
| `migrations/INVOICING.sql` | Facturas, configuración por empresa, numeración atómica, permisos y control de cambios concurrentes. | Antes de utilizar la pestaña Facturación. |
| `migrations/RLS_ADMIN_WRITE_FIX.sql` | El rol `admin` de empresa también puede escribir. Antes solo podía `editor`. | Una vez, sobre una base de datos ya creada. |
| `migrations/PLANNING_TIMEZONE_FIX.sql` | Reinterpreta las tareas antiguas como hora de Madrid. | **Justo después** de desplegar el panel nuevo. |
| `migrations/PLANNING_REMINDERS.sql` | Recordatorios por email de Planning. | Parte A ya; parte B (el cron) cuando el dominio esté verificado en Resend. |
| `migrations/ANALYTICS_PRIVACY_UPGRADE.sql` | Visitantes anónimos con sal diaria, fuentes de tráfico e idioma. Sustituye el `session_id` que generaba el navegador. | Antes de desplegar el snippet nuevo en las webs. |
| `migrations/ANALYTICS_ENGAGEMENT.sql` | Scroll, tiempo en página, páginas 404 y las conversiones reservadas (teléfono, email, formulario). | Después de la anterior. **Luego vuelve a ejecutar `schema/ANALYTICS_AGGREGATION.sql`**: la función nueva rellena las columnas que crea esta migración. |

## Mantenimiento

| Fichero | Para qué |
|---|---|
| `maintenance/BILLING_SECURITY_AUDIT.sql` | Consultas de solo lectura para RLS, permisos, referencias, bucket y documentos inválidos. |
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
