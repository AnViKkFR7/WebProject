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

El usuario confirma que desplegó `send-quote-approval-link` y `send-billing-due-reminders` después del ajuste del renderer y valida visualmente los emails. La revisión estática detectó que el renderer anterior convertía todos los enlaces editados en CTA y los marcaba `role="button"`; ahora solo el enlace de aprobación tiene estilo CTA y todos conservan semántica de enlace. El 28/10/2026 el usuario confirmó la recepción de un aviso real de vencimiento de prueba; esa entrega no valida por sí sola la baja ni los reintentos/idempotencia. Tampoco se han definido los datos legales para un pie común. La migración de plantillas debe constar aplicada en el entorno antes de usar la configuración guardada; la confirmación del despliegue de Edge no demuestra ese estado de la base de datos.

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

La clave idempotente es `billing-due/<queue-id>/<generation>`. Los reintentos automáticos usan backoff de 30s con máximo de una hora y hasta ocho intentos, con un lease máximo de 20 horas para no repetir después de que Resend pueda olvidar la clave. Una aceptación cuyo registro local falla queda como incierta y no se puede reintentar automáticamente. Enviados se purgan a 90 días y fallidos/omitidos a 180 días al programar la purga diaria. La cola requiere SQL aplicado, Edge desplegada y cron/secretos configurados. La migración ha sido validada en PGlite y el usuario confirmó una entrega real de prueba para `WatchEcommerceDemo`; la baja, la idempotencia en reintentos y la configuración DNS/proveedor no se verificaron con esa prueba.

## Resumen semanal para administradores

**Entrega validada por el usuario el 28/10/2026:** recibió el email de prueba de `WatchEcommerceDemo` tras la corrección de los tipos de email del RPC. El diseño MoiraOrdo fue aprobado visualmente; su despliegue y una segunda entrega para comprobarlo quedan pendientes.

El diseño semanal usa la marca MoiraOrdo (azul noche `#00051e`, papel `#fcfbf7`, azul `#1f63cc` y celeste `#82daff`) y agrupa las ocho métricas existentes en pendientes, actividad y planning. No incorpora las cifras económicas ni variaciones porcentuales del ejemplo comercial, porque el payload no las incluye. El enlace «Abrir el panel» usa el origen HTTPS de `ADMIN_APP_URL` o `https://admin.moiraordo.es/`, y el pie enlaza a `https://www.moiraordo.es`. La plantilla de marca del resumen es común a la plataforma y no pertenece al editor de emails para clientes.

Previsualización: ejecutar `node scripts/preview-weekly-summary.mjs` genera `docs/previews/weekly-summary.html` y `docs/previews/weekly-summary-quiet.html` con datos ficticios usando el mismo renderer de Edge. Con Vite activo, la copia de desarrollo se abre en `/weekly-summary-preview.local.html`. Revisión local a 375/768/1280 px; la apariencia específica de Gmail/Outlook deberá confirmarse después del despliegue del diseño.

No tiene pestaña ni configuración por empresa en el panel. Se envía automáticamente cada lunes a las 09:00 de `Europe/Madrid` y resume la semana anterior. Las empresas existentes y nuevas quedan activadas por la migración `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`. Los destinatarios se consultan al enviar: emails de todas las personas con rol administrador y membresía activa en esa compañía. Direcciones y métricas se transmiten a Resend; se usa `bcc` para ocultar la lista entre destinatarios y no se guardan en la cola.

El mensaje contiene solo conteos agregados: solicitudes y contactos nuevos, seguimientos vencidos, facturas emitidas/vencidas, presupuestos enviados sin respuesta, tareas de la semana siguiente y páginas vistas. No incluye nombres, emails de clientes, números ni importes de facturas, títulos/contenido de tareas ni origen/campañas. Los módulos apagados no aportan cifras. Si no hay dirección de administrador activa, se marca como fallo sin enviar.

`WEEKLY_SUMMARY_EMAIL.sql` crea la cola única por compañía y semana, reintentos y purga. `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` activa el envío y revoca la lectura y configuración por usuario. `send-weekly-summary` relee los conteos y destinatarios justo antes de llamar a Resend. La clave es `weekly-summary/<queue-id>/<generation>`; con `WEEKLY_SUMMARY_RETRY_WINDOW.sql`, usa backoff, máximo ocho intentos, lease de 10 minutos y un plazo fijo de 20 horas desde el primer intento, sin reiniciarlo al recuperar. La Edge revalida justo antes de enviar y limita la petición a 15 segundos. Despliegue coordinado y revisión de intentos antiguos en `docs/weekly-summary-retry-window.md`. Si Resend acepta el email pero falla el marcador local, queda como incierto y no se reenvía automáticamente. Enviados se purgan a 90 días y fallidos/omitidos a 180. La programación no opera hasta desplegar Edge y cron.

El usuario autorizó expresamente el destino Resend y el contenido agregado descrito. `WEEKLY_SUMMARY_EMAIL_CRON.sql` programa la ejecución cada cinco minutos (el worker encola los lunes a las 09:00 Madrid) y la purga diaria. Nombres de secretos, URL y orden de aplicación están en `docs/setup-servicios-externos.md`.

### Validación de entrega aislada

El cron semanal normal abarca todos los tenants habilitados. Para cumplir el límite de pruebas en `WatchEcommerceDemo`, la migración `WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql` crea una tabla de ejecución única y RPC de servicio que solo resuelven la empresa con ese nombre exacto. La rama `watch_test` en `send-weekly-summary` procesa únicamente esa ejecución, consulta los emails de sus administradores activos y calcula métricas agregadas de la semana anterior. El mensaje se marca `[PRUEBA]`. No usa ni modifica la cola semanal habitual.

El circuito aislado ya entregó el email según confirmación del usuario. El registro no se debe borrar ni reiniciar. `WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql` corrige el tipo de emails en ambos payloads y conserva la recuperación acotada del primer intento fallido. `WEEKLY_SUMMARY_EMAIL_WATCH_RESEND.sql` añade una sola ejecución adicional tras una entrega exitosa, con un UUID distinto y clave idempotente nueva; solo resuelve `WatchEcommerceDemo` y nunca toca la cola de producción. La activación es `database/maintenance/WEEKLY_SUMMARY_EMAIL_WATCH_TEST.sql`; hay que desplegar primero el Edge actualizado.

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



## Auditoría 18–21: métricas e invitaciones

El resumen cuenta primeras emisiones verificables, vencidas con saldo consolidado y ocurrencias recurrentes dentro de la semana de Madrid. Advierte de históricos sin fecha verificable y explica el recuento por repetición. Requiere `WEEKLY_SUMMARY_METRICS.sql` y publicar `send-weekly-summary` con el renderer compartido actualizado.

Las invitaciones separan cuenta/membresía de la petición de correo: aceptada no significa recibida. Los resultados inciertos no se reenvían automáticamente; el panel conserva el contexto y permite reintento explícito tras el mínimo de 60 segundos. Una cuenta confirmada se vincula sin otro correo y una membresía suspendida no se reactiva. `SITE_URL` y `/reset-password` permitido en Auth son obligatorios. Procedimiento y límites: `docs/auditoria-cierre-18-21.md`.
