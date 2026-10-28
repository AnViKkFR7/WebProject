# Emails transaccionales y recordatorios

## Emails al cliente: marca y editor

La vista previa convierte el logo a una imagen de datos local para que el iframe aislado lo pueda mostrar; al enviar, el renderizador sigue usando un adjunto CID para evitar depender de una URL pública. Los botones de acción de email se presentan como CTA con estilo de botón, pero se implementan como enlaces HTML (`<a href>`): los clientes de correo no ofrecen soporte interoperable para botones HTML que naveguen a una URL. «Revisar presupuesto» conserva así navegación y funciona en los clientes principales. El pie «powered by MoiraOrdo» enlaza a https://www.moiraordo.es. Las paletas guardadas de la empresa se pueden elegir en la configuración de emails; el logo sigue siendo una preferencia separada.

El diseño toma como referencia una composición editorial: fondo cálido, tarjeta blanca con esquinas redondeadas, cabecera de marca y tipografía serif. Presupuesto y vencimiento tienen jerarquías distintas: el presupuesto muestra una tarjeta neutra con número/vigencia y da protagonismo al CTA de revisión; el recordatorio usa un titular serif, una introducción y una tarjeta clara de saldo con factura/vencimiento, sin CTA de aprobación. La empresa aparece junto al aviso «Este mensaje te lo envía». El logo se sitúa a su lado, dentro de una insignia blanca compacta, limitado a 72 × 48 px y sin deformarse. «Editorial» usa la tinta oscura como cabecera; «Color de marca» usa el acento de la paleta. En móvil se reducen los márgenes y el CTA ocupa el ancho disponible. El pie «powered by MoiraOrdo» enlaza a su web y aparece una sola vez.

La implementación local cubre las plantillas existentes que llegan al cliente: enlace de aprobación de presupuesto y recordatorio de vencimiento de factura. Las facturas emitidas no tienen actualmente envío por email. Los avisos a administradores, Planning y el resumen semanal son internos y quedan fuera de este editor.

El apartado **Configuración → Emails** permite a la persona administradora de la empresa cambiar el diseño (clásico o marca destacada), logo, paleta, idioma predeterminado de envío (ES/EN) y HTML/asunto/preencabezado por tipo e idioma. El idioma predeterminado se aplica a enlaces de presupuesto y avisos automáticos de vencimiento; español se usa si el ajuste falta o no es reconocido. Esto hace operativas ambas plantillas de idioma; el selector de idioma de plantilla sigue controlando qué variante se edita y previsualiza. El logo y la paleta se comparten entre todas las plantillas; no hay ajustes por documento ni por envío individual. La vista previa usa datos ficticios y un iframe aislado; no envía correo. La migración guarda una configuración por empresa detrás de RPC con verificación de rol; la tabla y el historial no admiten acceso directo de usuarios. Cada guardado conserva hasta diez configuraciones anteriores con fecha e ID del usuario; restaurar una versión crea una nueva entrada para mantener la trazabilidad.

Al enviar, el renderizador común escapa los valores, limita el vocabulario HTML y los enlaces, genera HTML y texto plano y elige texto blanco o negro con contraste suficiente en el bloque de origen. El enlace de aprobación conserva semántica de enlace aunque tenga apariencia de botón; otros enlaces editados mantienen apariencia de enlace normal y no se anuncian como botones. El logo se adjunta como imagen CID. Si una plantilla guardada no es válida, el emisor usa la plantilla predefinida. Se conserva la idempotencia de cada envío.

El encabezado visible dice «Este mensaje te lo envía {empresa}»; el remitente técnico sigue siendo el dominio verificado de MoiraOrdo y no se falsifica el dominio de la empresa. El pie dice «Recurso digital powered by MoiraOrdo». La plantilla de aprobación de presupuesto sigue enviándose solo tras acción expresa del administrador. El aviso de vencimiento conserva los datos previamente autorizados: email del cliente, número, fecha de vencimiento y saldo pendiente.

El renderer recibe el nombre de la empresa, la marca y los datos propios del mensaje; no obtiene NIF, dirección, email, teléfono ni web para el pie. El registro general de empresa tiene contacto y web, pero la identidad fiscal (NIF/dirección) se conserva como copia del emisor en cada documento. El editor HTML permite texto fijo por plantilla/idioma, pero aún no existe un pie legal común parametrizado. Antes de automatizarlo hay que decidir qué datos deben aparecer y confirmar su inclusión en los emails enviados a Resend.

### Activación y comprobación

1. Comprobar la secuencia de `database/README.md`; ejecutar `migrations/COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql` después de `BILLING_APPEARANCE.sql`, `COMPANY_MODULES.sql` y `BILLING_DUE_REMINDERS.sql`. En bases existentes, ejecutar únicamente migraciones que falten.
2. Ejecutar `maintenance/COMPANY_CUSTOMER_EMAIL_TEMPLATES_PREFLIGHT.sql`. Se esperan `true` en todas las columnas, especialmente RLS, acceso directo denegado, RPC authenticated y RPC worker.
3. Desplegar el frontend y las funciones `send-quote-approval-link` y `send-billing-due-reminders` desde la misma revisión. La función de recordatorios debe conservar su secreto de cron.
4. Probar con un presupuesto y una factura de prueba, a destinatarios controlados: idioma/template por defecto, remitente visible, enlaces, logo, versión texto, fallback y que no haya duplicados ante reintento.

El usuario confirma que desplegó `send-quote-approval-link` y `send-billing-due-reminders` después del ajuste del renderer y valida visualmente los emails. La revisión estática detectó que el renderer anterior convertía todos los enlaces editados en CTA y los marcaba `role="button"`; ahora solo el enlace de aprobación tiene estilo CTA y todos conservan semántica de enlace. No se afirma una prueba de entrega/idempotencia de los recordatorios ni se han definido los datos legales para un pie común. La migración de plantillas debe constar aplicada en el entorno antes de usar la configuración guardada; la confirmación del despliegue de Edge no demuestra ese estado de la base de datos.

## Aprobación y respuesta de presupuestos

El administrador puede enviar al cliente el enlace de aprobación guardado en el presupuesto. `send-quote-approval-link` obtiene el destinatario y el número desde la cotización en Supabase, valida que el usuario tenga permisos y envía el enlace al correo guardado; el token aleatorio viaja en el fragmento de URL y solo su hash se almacena. Resend recibe el correo del cliente, nombre de la empresa, número de presupuesto, caducidad y enlace. Guarda fecha e ID del proveedor para trazabilidad. La clave idempotente es `quote-approval-link/<link-id>`; Resend conserva la clave 24 horas. Es un envío bajo acción explícita del administrador, no una cola de campañas.

Tras aceptar/rechazar, `notify-quote-approval-response` avisa a las direcciones de administradores activos de la empresa (primero `to`, restantes en `bcc`). El aviso incluye nombre/email declarados por el cliente, número de presupuesto, decisión, fecha y enlace directo al panel. Resend recibe estos datos. La clave idempotente es `quote-approval-response/<link-id>`; la BD guarda fecha/ID de proveedor y no duplica un aviso ya marcado. Si falla el envío, el usuario ve un aviso de error y puede reintentarlo desde la página de respuesta mientras conserve ese enlace. No hay cron ni cola de reintentos para este email; validar el correo con destinatarios de prueba antes de usarlo en producción.

Las respuestas se muestran en el panel del presupuesto y en el dashboard (máximo cinco de los últimos 90 días). El dashboard permite abrir directamente el presupuesto. Cada nueva respuesta queda asociada a su enlace; después de modificar un rechazo hay que guardar el presupuesto como enviado y generar un enlace nuevo. Se conserva la historia anterior.

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

