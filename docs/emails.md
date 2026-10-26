# Emails transaccionales y recordatorios

## Estado del envío de Planning

El recordatorio de Planning ya tiene código local para consumir `PLANNING_EMAIL_QUEUE.sql`: encola ocurrencias, reclama un lote, valida membresía activa, reconstruye el mensaje y lo envía a Resend. La migración, Edge Function y cron no se han verificado como desplegados en el destino.

`PLANNING_EMAIL_QUEUE.sql` va después de `PLANNING_REMINDER_PAYLOAD_FIX.sql`: conserva ocurrencias con reclamación concurrente y lease, reintentos exponenciales acotados, códigos de fallo sin texto del proveedor, lista por empresa y reintento restringido a editor/admin. La Edge Function mantiene una clave idempotente durante los reintentos automáticos; un reintento manual autorizado crea una generación y clave nuevas solo para envíos que el proveedor rechazó. Errores `sent_marker_failed` indican que Resend pudo aceptar el correo pero el sistema no confirmó el registro: se muestran para conciliación y no se ofrece un reenvío que pudiera duplicarlo tras caducar la clave de 24 horas. Un trabajo que siga bloqueado durante 20 horas también pasa a ese estado incierto antes de que Resend pueda olvidar la clave. El panel ofrece Planning → Avisos: los miembros pueden consultar fallos de su compañía y solo editor/admin pueden reintentarlos. La migración está validada en PGlite; el código necesita despliegue de base de datos/Edge para operar.

La petición a Resend debe incluir una clave idempotente estable por cola. Resend conserva claves durante 24 horas; las tareas de reintento deben permanecer dentro de ese plazo para que una respuesta perdida no duplique correos. [Documentación oficial sobre claves idempotentes](https://resend.com/changelog/idempotency-keys).

## Avisos de vencimiento de facturas

El usuario autorizó expresamente enviar a Resend el email del cliente, número de factura, saldo pendiente y fecha de vencimiento. La nueva Edge Function `send-billing-due-reminders` compone el correo con esos cuatro datos; no incluye nombre, NIF, dirección, conceptos, notas ni adjuntos. La cola guarda solo empresa/factura, vencimiento, intervalo, estado, intentos, código de fallo e ID del proveedor; no conserva email ni cuerpo.

`BILLING_DUE_REMINDERS.sql` debe aplicarse después de `BILLING_PAYMENTS_HISTORY.sql`, `BILLING_RECTIFYING_INVOICES.sql` y `COMPANY_MODULES.sql`. Configuración inicial: desactivada; intervalos `7, 1, 0, -7` días en hora `09:00` de `Europe/Madrid`. Solo admin de empresa/plataforma configura el calendario. Un editor/admin puede excluir una factura emitida; la preferencia se conserva por factura y compañía. Cobro completo, factura no emitida, módulo desactivado o baja invalidan el envío. El servidor vuelve a comprobar esas condiciones justo antes de consultar el email y llamar a Resend.

La clave idempotente es `billing-due/<queue-id>/<generation>`. Los reintentos automáticos usan backoff de 30s con máximo de una hora y hasta ocho intentos, con un lease máximo de 20 horas para no repetir después de que Resend pueda olvidar la clave. Una aceptación cuyo registro local falla queda como incierta y no se puede reintentar automáticamente. Enviados se purgan a 90 días y fallidos/omitidos a 180 días al programar la purga diaria. La cola no se activa hasta aplicar SQL, desplegar Edge y configurar el cron/secretos. La migración ha sido validada en PGlite; el envío real y la configuración DNS/proveedor no se han probado.

## Resumen semanal para administradores

No tiene pestaña ni configuración por empresa en el panel. Se envía automáticamente cada lunes a las 09:00 de `Europe/Madrid` y resume la semana anterior. Las empresas existentes y nuevas quedan activadas por la migración `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`. Los destinatarios se consultan al enviar: emails de todas las personas con rol administrador y membresía activa en esa compañía. Direcciones y métricas se transmiten a Resend; se usa `bcc` para ocultar la lista entre destinatarios y no se guardan en la cola.

El mensaje contiene solo conteos agregados: solicitudes y contactos nuevos, seguimientos vencidos, facturas emitidas/vencidas, presupuestos enviados sin respuesta, tareas de la semana siguiente y páginas vistas. No incluye nombres, emails de clientes, números ni importes de facturas, títulos/contenido de tareas ni origen/campañas. Los módulos apagados no aportan cifras. Si no hay dirección de administrador activa, se marca como fallo sin enviar.

`WEEKLY_SUMMARY_EMAIL.sql` crea la cola única por compañía y semana, reintentos y purga. `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` activa el envío y revoca la lectura y configuración por usuario. `send-weekly-summary` relee los conteos y destinatarios justo antes de llamar a Resend. La clave es `weekly-summary/<queue-id>/<generation>`; usa backoff, máximo ocho intentos y lease de 20 horas, por debajo de las 24 horas de retención de claves idempotentes de Resend. Si Resend acepta el email pero falla el marcador local, queda como incierto y no se reenvía automáticamente. Enviados se purgan a 90 días y fallidos/omitidos a 180. La programación no opera hasta desplegar Edge y cron.

El usuario autorizó expresamente el destino Resend y el contenido agregado descrito. `WEEKLY_SUMMARY_EMAIL_CRON.sql` programa la ejecución cada cinco minutos (el worker encola los lunes a las 09:00 Madrid) y la purga diaria. Nombres de secretos, URL y orden de aplicación están en `docs/setup-servicios-externos.md`.

## Códigos de fallo y reintentos

La cola no almacena dirección de correo, título ni cuerpo: vuelve a consultar el destinatario y los datos de tarea inmediatamente antes del envío, revalidando membresía activa y empresa. Guarda únicamente ID de usuario/tarea/empresa, ocurrencia, número de intentos, código estable, hora y ID devuelto por proveedor. Los logs de la Edge incluyen solo código, fecha y metadata fija `DEPLOYMENT_ENV`/`APP_VERSION`; no almacenan respuestas crudas de Resend, credenciales, direcciones ni contenido del correo.

Los reintentos automáticos usan 30 segundos, 60 segundos, 120 segundos y duplican hasta un máximo de una hora, con ocho intentos máximos. El cron actual se ejecuta cada cinco minutos, por lo que cada reintento se procesa en la primera pasada posterior a su tiempo disponible. Errores permanentes (destinatario no disponible, miembro inactivo o tarea borrada) pasan a `dead`. El panel muestra hasta 100 fallos de la compañía activa; editor/admin pueden volver a encolarlos. La fila queda en la cola como historial operativo y no se borra al reintentar; enviados se purgan a 90 días y fallidos a 180 días cuando se programe la función de purga.

## Remitente y autenticación del dominio

1. Elegir el dominio/remitente transaccional y aprobar el proveedor.
2. Configurar en el proveedor SPF y DKIM con los valores exactos que este entregue. Mantener un único registro SPF por dominio y combinar remitentes existentes con cuidado.
3. Publicar DMARC inicialmente en modo de observación, revisar informes y elevar la política de manera gradual con la persona responsable del correo.
4. Verificar estado del dominio en el proveedor, remitentes autorizados, rebotes y supresiones.
5. Guardar `RESEND_API_KEY` y `REMINDERS_CRON_SECRET` en secretos del proyecto; `REMINDERS_FROM_EMAIL` debe usar un dominio verificado. El cron obtiene su secreto de Vault, no de texto SQL.
6. Probar en desarrollo con buzones de prueba y consentimiento; comprobar que permisos vencidos no reciben recordatorios. Solo después programar el cron y vigilar sus ejecuciones.

La configuración SPF/DKIM/DMARC, el remitente verificado y la autenticación de marca no se validan desde el repositorio: requieren acceso DNS/proveedor y revisión del entorno.

