# Avisos obsoletos de Planning · entrega 13

## Comportamiento

Cada aviso nuevo guarda task_version, la versión de la tarea al encolarlo. El trigger de versiones de PLANNING_TASK_MOVE_UNDO ya incrementa la versión en cada actualización. Un nuevo trigger invalida trabajos queued/sending al editar la tarea, incluidos contenido, destinatario, fechas, recurrencia y avisos. Los enviados y sus marcadores no se modifican.

El worker vuelve a leer la tarea y construye el mensaje; justo antes de contactar al proveedor llama a validate_planning_email_delivery con ID de cola, empresa, tarea y versión utilizada. La RPC comprueba estado sending, identidad, versión, autor/destinatario con membresía activa, recordatorio activado, módulo y pertenencia exacta de la ocurrencia a la serie actual. Usa el cálculo de Madrid de la entrega 12. Si falla la comprobación, descarta el trabajo; si la RPC falla, no envía y registra fallo operativo para reintentar según las reglas existentes.

La comprobación bloquea tarea y después cola para mantener el mismo orden que el trigger. El bloqueo termina al concluir la RPC: no mantiene una transacción abierta durante la llamada HTTP. Una edición posterior a esa comprobación puede coincidir con un correo ya en vuelo. No se puede retirar un correo ya aceptado por el proveedor. Si llega su confirmación después de invalidar el trabajo, complete_planning_email registra el envío y el marcador, aunque el estado haya pasado a skipped, evitando un reenvío automático.

## Reintentos e historial

Un trabajo skipped puede volver a encolarse con nueva versión solo si nunca se ha intentado (attempt_count=0, delivery_generation=0 y sin ID de proveedor). Si cambió la fecha, una ocurrencia distinta obtiene su propio trabajo. Una ocurrencia que ya pudo haberse entregado no se rearma automáticamente al editar su tarea. Un reintento manual de una dead letter exige que siga correspondiendo a la versión actual.

Al aplicar la migración, los trabajos antiguos queued/sending ya intentados pasan a dead/sent_marker_failed para revisión operativa. No se presume que no se enviaron ni se cambia su clave para reenviarlos. Solo los trabajos antiguos sin intentos reciben una versión actual de referencia; los históricos conservan task_version desconocido (NULL). Esta migración no inventa una versión histórica de emisión. Los trabajos obsoletos usan el código existente task_unavailable y estado skipped, sin introducir un error de negocio nuevo en la UI.

## Despliegue

1. Identificar y pausar el scheduler real de recordatorios de Planning. Esperar a que finalicen los workers en vuelo; no basta con desactivar futuras ejecuciones si ya hay una activa.
2. Revisar queued/sending/dead y confirmar que los intentos antiguos marcados inciertos se van a conciliar manualmente.
3. Aplicar PLANNING_EMAIL_STALE_GUARD.sql después de PLANNING_TASK_MOVE_UNDO, PLANNING_RECURRENCE_WINDOW y COMPANY_MODULES_RPC_COMPLETION; requiere también PLANNING_EMAIL_QUEUE y sus helpers vigentes. No volver a aplicar definiciones anteriores que eliminen el guardado de task_version.
4. Desplegar send-planning-reminders junto con la SQL. Un worker antiguo no llama a la nueva comprobación; uno nuevo sin migración falla cerrado. No reanudar cron con versiones descoordinadas.
5. Probar en entorno controlado: encolar, editar/desactivar aviso, intentar entregar y verificar ausencia de llamada al proveedor; probar tarea intacta, nueva ocurrencia y confirmación tardía. Revisar permisos service_role, membresías y módulo.
6. Reanudar el scheduler y observar descartes, errores y cola. No reenviar trabajos inciertos hasta conciliar el proveedor.

No requiere publicación del panel. La migración no invoca el proveedor ni manda correos. Las operaciones remotas descritas no se han realizado en esta entrega.

## Validación

30 pruebas pasan en cinco archivos (SQL y worker). Incluyen actualización tras claim, rearme seguro, ocurrencia nueva, recurrencia/minutos/módulo, aislamiento por empresa, permisos, confirmación tardía e incertidumbre heredada. El test de carrera intercala operaciones de forma controlada; no simula conexiones concurrentes reales ni un proveedor real. Lint de tests JS y compilación de las 13 Edge Functions correctos. Pendiente validar concurrencia y despliegue coordinado en entorno controlado.
