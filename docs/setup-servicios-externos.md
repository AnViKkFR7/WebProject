# Preparación de servicios externos

## Resend y DNS para recordatorios

La aplicación contiene emisores de correo transaccional separados para recordatorios de Planning (`send-planning-reminders`) y de vencimiento de facturas (`send-billing-due-reminders`). Cada uno tiene su propio nombre de secreto de cron en Edge Functions y Vault; no reutilices uno para el otro. El estado desplegado de Planning tampoco está comprobado y no se despliega en esta entrega. La activación de Planning requiere todos estos pasos en entorno de desarrollo:

1. Confirmar proyecto Supabase y backup/restauración probada.
2. Verificar dominio/remitente en Resend y publicar SPF, DKIM y DMARC según sus instrucciones vigentes.
3. Configurar `RESEND_API_KEY`, `REMINDERS_FROM_EMAIL` y `REMINDERS_CRON_SECRET` en secretos de la Edge Function. Guardar el mismo secreto de cron en Vault. Definir además metadata no secreta `DEPLOYMENT_ENV` (`development`, `staging` o `production`) y `APP_VERSION` para identificar el origen de logs filtrados.
4. Aplicar `PLANNING_REMINDERS.sql` parte A y `PLANNING_REMINDER_PAYLOAD_FIX.sql`.
5. Aplicar `PLANNING_EMAIL_QUEUE.sql` después de la anterior; no hay cambio destructivo de datos previos.
6. Desplegar `send-planning-reminders` con `--no-verify-jwt`; validar primero en desarrollo la clave estable de Resend, respuesta perdida, 409 idempotente, 429 y 5xx.
7. Comprobar en Planning → Avisos la lista por compañía y el reintento con roles viewer/editor. Probar un error permanente y uno transitorio con datos ficticios.
8. Programar la purga diaria `select public.purge_planning_email_queue();` bajo service_role y revisar límites de retención.
9. Confirmar logs sin PII, expiración/rotación de secretos y respuesta a rebotes. Activar cron únicamente tras una prueba supervisada.

Nunca incluir claves en `cron.schedule`, commits, capturas o código cliente. La configuración del dominio/remitente y las pruebas de correo son verificaciones externas aún pendientes.

### Configurar el cron de avisos de vencimiento de facturas

El cron necesita **dos entradas de Vault**. Vault es el almacén cifrado de Supabase; el nombre identifica la entrada y el secreto es el valor que se guarda dentro. El script de cron solo lee esas entradas al ejecutarse.

1. En **Edge Functions → Secrets**, configura `BILLING_REMINDERS_CRON_SECRET` con un valor aleatorio fuerte. En el mismo apartado configura `RESEND_API_KEY` y `REMINDERS_FROM_EMAIL` con los valores del proveedor/remitente verificado.
2. En **Database → Vault**, crea `billing_due_reminders_cron_secret` y pon dentro exactamente el mismo valor usado para `BILLING_REMINDERS_CRON_SECRET`. No son dos claves diferentes: la Edge Function y el cron deben compartirlo para que la petición se autorice.
3. En Vault, crea `billing_due_reminders_function_url` y pon dentro la URL de la Edge Function, con este formato: `https://<PROJECT_REF>.supabase.co/functions/v1/send-billing-due-reminders`. En este proyecto, el ref conocido es `pakbxfdewswzkipeddhr`.
4. `supabase/config.toml` fija `verify_jwt = false` únicamente para `send-billing-due-reminders`, que autoriza las llamadas del cron con su propio header secreto. Despliega con `supabase functions deploy send-billing-due-reminders --project-ref pakbxfdewswzkipeddhr --no-verify-jwt`; el flag conserva la configuración también si la CLI no está usando este archivo. Solo entonces abre `database/migrations/BILLING_DUE_REMINDERS_CRON.sql` y ejecuta el fichero completo en el SQL Editor.
5. Si el cron devuelve `Create both billing reminder secrets in Vault before scheduling`, revisa en Vault que existan **ambos nombres escritos exactamente** y vuelve a ejecutar el mismo archivo. No ejecutes otra vez la migración principal para resolver este mensaje.

El valor de `billing_due_reminders_cron_secret` es una credencial: no lo guardes en Git, en `cron.schedule`, en capturas ni en mensajes. `billing_due_reminders_function_url` no es una clave de API, pero se guarda en Vault para que la URL no quede copiada en el código del trabajo cron. El SQL del cron desprograma y vuelve a crear los trabajos con nombres fijos, así que puede ejecutarse otra vez después de corregir la configuración.

**Diagnóstico de autenticación:** un `401 Unauthorized` suele ocurrir en el gateway antes de que se ejecute el handler si la verificación JWT sigue activa. El propio handler responde `403 forbidden` cuando falta `BILLING_REMINDERS_CRON_SECRET` o no coincide con `billing_due_reminders_cron_secret` de Vault. Para corregir el `401`, volver a desplegar esta función con `--no-verify-jwt` o desactivar Verify JWT en su configuración de Supabase; no añadir un JWT al cron.

### Configurar el resumen semanal

Orden para esta funcionalidad; ejecuta cada archivo completo y no repitas las migraciones base si ya están aplicadas:

1. Confirma que ya existen Analítica (`schema/ANALYTICS_SCHEMA.sql`), Planning (`schema/PLANNING_SCHEMA.sql`), CRM (`migrations/CRM_CONTACTS_PIPELINE.sql`), facturas/presupuestos e historial (`migrations/INVOICING.sql`, `migrations/QUOTES.sql`, `migrations/BILLING_PAYMENTS_HISTORY.sql` y `migrations/BILLING_DUE_REMINDERS.sql`) y módulos (`migrations/COMPANY_MODULES.sql`).
2. Ejecuta `database/migrations/WEEKLY_SUMMARY_EMAIL.sql` solo si aún falta.
3. Ejecuta `database/migrations/WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`. Activa empresas existentes y nuevas; el envío queda fijado al lunes a las 09:00 de Madrid y no tiene controles en el panel.
4. Despliega `send-weekly-summary` con `--no-verify-jwt`. La función exige su secreto propio; no reutilices el secreto de Planning ni el de avisos de factura.
5. En Edge Functions → Secrets configura `WEEKLY_SUMMARY_CRON_SECRET` con un valor aleatorio fuerte, y los valores ya verificados de `RESEND_API_KEY` y `REMINDERS_FROM_EMAIL`.
6. En Database → Vault crea `weekly_summary_cron_secret` con exactamente el mismo valor que `WEEKLY_SUMMARY_CRON_SECRET`; crea `weekly_summary_function_url` con `https://<PROJECT_REF>.supabase.co/functions/v1/send-weekly-summary`.
7. Ejecuta `database/migrations/WEEKLY_SUMMARY_EMAIL_CRON.sql` al final. Si informa que faltan secrets, vuelve a comprobar esos dos nombres de Vault antes de repetir el mismo fichero.
8. Revisa la ejecución y la cola del cron. El correo se envía a administradores activos; no hay una pestaña que habilitar.

La función envía a Resend los correos de administradores activos y solo los conteos agregados descritos en `docs/emails.md`. La cola no guarda correos ni estadísticas. `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` activa las empresas en la BD; no se envía nada hasta desplegar Edge y programar el cron.

#### Prueba única limitada a WatchEcommerceDemo

**Estado del 28/10/2026:** el usuario confirma la recepción tras aplicar las correcciones. La prueba está completada. Para activar el nuevo diseño semanal, redesplegar únicamente `send-weekly-summary` con `--no-verify-jwt`; no volver a ejecutar los SQL de activación o recuperación. El mismo renderer genera la vista previa local descrita en `docs/emails.md`.

El cron normal procesa todas las empresas habilitadas y no debe usarse para una prueba de un solo tenant. Para enviar una prueba aislada, solo a administradores activos de `WatchEcommerceDemo`:

1. Ejecuta `database/migrations/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql` después de `WEEKLY_SUMMARY_EMAIL.sql` y `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` (ya aplicado en esta prueba).
2. Ejecuta la corrección `database/migrations/WEEKLY_SUMMARY_EMAIL_WATCH_TEST_FIX.sql`; corrige el SQLSTATE `42702` en el RPC y no cambia filas ni membresías.
   Después aplica `database/migrations/WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql`: convierte explícitamente los emails `varchar` de Supabase en `text[]` para ambos RPC de payload. Permite una sola recuperación del test fallido, conservando ID/generación y dentro de las 20 horas desde la creación original.
3. La función actualizada ya llegó a ejecutarse (petición 3042), así que no hace falta redesplegarla para esta corrección SQL. Si no se hubiera desplegado aún, usar `supabase functions deploy send-weekly-summary --project-ref pakbxfdewswzkipeddhr --no-verify-jwt`.
4. Ejecuta una sola vez `database/maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql` en Supabase SQL Editor. Usa `weekly_summary_cron_secret` y `weekly_summary_function_url` ya guardados en Vault; no requiere pegar secretos.
5. Comprueba el resultado de la petición en logs de `send-weekly-summary` y revisa la bandeja de los administradores activos de `WatchEcommerceDemo`. El asunto empieza por `[PRUEBA]` y el contenido la identifica como envío de prueba.

El script falla cerrado si no encuentra exactamente una empresa con ese nombre, si el resumen está deshabilitado o si no hay admin activo con email. La prueba genera una ejecución en un ledger separado, consulta las métricas agregadas de la semana anterior y no añade ni reclama filas de `company_weekly_summary_queue`. No borres el registro de prueba para volver a enviarlo: se conserva como protección y trazabilidad. La corrección de entrega permite una única recuperación manual si el registro está `dead/unexpected_failure`, no tiene ID de proveedor, tiene un solo intento y no han pasado 20 horas. Conserva el UUID y la generación de Resend; rechaza envíos ya aceptados, estados inciertos de confirmación, recuperaciones agotadas y registros fuera del plazo.

**Recuperación del intento del 28/10/2026:** la migración original, el FIX de ambigüedad y la Edge ya están aplicados. Ejecutar únicamente `database/migrations/WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql` y luego copiar y ejecutar una vez el contenido actualizado de `database/maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql`. No hace falta redesplegar Edge para esta corrección SQL. Si el script indica plazo agotado, no borrar ni reiniciar la fila.

**Reenvío único para revisar el nuevo diseño (28/10/2026):** la ejecución anterior consta como enviada y el usuario solicita una segunda prueba. Aplicar `database/migrations/WEEKLY_SUMMARY_EMAIL_WATCH_RESEND.sql` después de `WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql`; desplegar `send-weekly-summary` con `--no-verify-jwt`; después ejecutar una sola vez `database/maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql`. Este script genera una clave de solicitud y los RPC solo admiten una repetición adicional para `WatchEcommerceDemo`. No volver a ejecutarlo si se ha solicitado; consultar Logs y el ledger antes de actuar ante una respuesta ambigua.

### Enlaces y notificaciones de aprobación de presupuestos

La base debe tener `QUOTES.sql`, `BILLING_QUOTE_APPROVAL.sql` y después `BILLING_QUOTE_APPROVAL_REVISIONS.sql`. Tras aplicar las revisiones, ejecuta el archivo completo `database/maintenance/BILLING_QUOTE_APPROVAL_PREFLIGHT.sql`; ahora también comprueba columnas de trazabilidad, nuevas RPC y permisos. No vuelvas a ejecutar las dos migraciones previas si ya están aplicadas.

En **Edge Functions → Secrets** deben estar configurados `RESEND_API_KEY`, `REMINDERS_FROM_EMAIL`, `SUPABASE_ANON_KEY` y `ADMIN_APP_URL`. El usuario ya confirmó `ADMIN_APP_URL`; debe ser el origen HTTPS del panel, por ejemplo `https://admin.tudominio.es`, sin `/quotes` ni barra final. `REMINDERS_FROM_EMAIL` debe ser un remitente verificado por Resend.

Desde la raíz del repositorio, despliega las funciones con la verificación JWT predeterminada de Supabase (no usar `--no-verify-jwt`):

```bash
supabase functions deploy send-quote-approval-link
supabase functions deploy notify-quote-approval-response
```

`send-quote-approval-link` requiere la sesión autenticada del administrador y solo obtiene por RPC el correo asociado al presupuesto de su empresa. `notify-quote-approval-response` recibe el token del enlace público, valida que tenga una respuesta registrada y envía la notificación a los administradores activos. Prueba ambos recorridos con presupuestos y buzones controlados; ambos envían correos reales al proveedor configurado. No se programa cron.

## No configurado por este documento

No se crean cuentas de proveedor, DNS, secretos, cron ni despliegues. No se integra VERI*FACTU ni se envían facturas a clientes; el único correo de cliente añadido en esta fase contiene un enlace de aprobación del presupuesto.



### Auditoría: ventana de recuperación del resumen normal

Aplicar `WEEKLY_SUMMARY_RETRY_WINDOW.sql` y desplegar `send-weekly-summary` con el scheduler pausado y las invocaciones anteriores terminadas. Seguir `docs/weekly-summary-retry-window.md`: el primer intento fija el plazo máximo de 20 horas; el lease de 10 minutos no lo amplía. No reiniciar intentos inciertos ni ejecutar el script Watch durante este despliegue. Esta corrección local todavía no acredita cambios en Supabase ni en cron.


### Auditoría 18–21: configuración de invitaciones

Antes de desplegar `invite-user`, aplicar `COMPANY_USER_INVITATION_STATE.sql` y configurar `SITE_URL` obligatorio, HTTPS salvo localhost, con `/reset-password` permitido en Auth Redirect URLs. Usa el SMTP de Supabase Auth existente y exige administrador de plataforma validado en servidor. Desplegar también `listar-usuarios`, `send-weekly-summary` y el panel conforme a `docs/auditoria-cierre-18-21.md`. Las tres migraciones y comprobaciones remotas están pendientes; no ejecutar una invitación de prueba salvo con buzón controlado.
