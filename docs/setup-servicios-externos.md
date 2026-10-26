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
4. Confirma que `send-billing-due-reminders` ya está desplegada con `--no-verify-jwt`. Solo entonces abre `database/migrations/BILLING_DUE_REMINDERS_CRON.sql` y ejecuta el fichero completo en el SQL Editor.
5. Si el cron devuelve `Create both billing reminder secrets in Vault before scheduling`, revisa en Vault que existan **ambos nombres escritos exactamente** y vuelve a ejecutar el mismo archivo. No ejecutes otra vez la migración principal para resolver este mensaje.

El valor de `billing_due_reminders_cron_secret` es una credencial: no lo guardes en Git, en `cron.schedule`, en capturas ni en mensajes. `billing_due_reminders_function_url` no es una clave de API, pero se guarda en Vault para que la URL no quede copiada en el código del trabajo cron. El SQL del cron desprograma y vuelve a crear los trabajos con nombres fijos, así que puede ejecutarse otra vez después de corregir la configuración.

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

## No configurado por este documento

No se crean cuentas de proveedor, DNS, secretos, cron ni despliegues. No se integra VERI*FACTU ni se envían facturas/presupuestos a clientes.

