# Recurrencias por intervalo · entrega 12

## Panel

La expansión recibe el intervalo del calendario y busca por índice la primera repetición que comienza dentro de él; no recorre todo el histórico. Genera únicamente las ocurrencias de ese tramo y devuelve vacío si ninguna coincide, sin sustituirlas por el registro maestro fuera del periodo. Las claves conservan el índice absoluto de la serie y los metadatos _seriesStart/_seriesEnd, necesarios para editar o mover la serie original.

Se eliminan el límite de 200 ocurrencias desde el origen y el horizonte de tres años. El límite de trabajo pasa a ser un intervalo máximo de 93 días por llamada, suficiente para las vistas actuales con márgenes. El fallback de consumidores sin intervalo es el mes actual con margen del calendario. No hay caducidad de la serie: se puede navegar a intervalos posteriores y anteriores. Como antes, la selección es por fecha de inicio, no introduce una nueva semántica de solapamiento de tareas largas.

Las recurrencias horarias suman tiempo transcurrido. Las diarias, semanales y anuales conservan la hora civil de Europe/Madrid, con el mismo criterio que PostgreSQL: hora estándar cuando una hora local es ambigua o no existe. Se calculan desde el origen para evitar deriva después de un salto de hora. Febrero 29 se ajusta a febrero 28 en años no bisiestos. La duración transcurrida de la tarea se conserva. Las fechas billing_date se operan como fechas sin hora y mantienen formato YYYY-MM-DD.

Planning pasa el intervalo tanto a tareas como a movimientos recurrentes de su vista de facturación. El texto ES/EN muestra el periodo de los importes: no son una suma de las primeras 200 ocurrencias futuras ni una previsión indefinida. Esta vista de movimientos de Planning es distinta de Facturas/Presupuestos.

## Recordatorios

PLANNING_RECURRENCE_WINDOW.sql reemplaza due_planning_reminders conservando firma y permisos de service_role. Valida ventanas de 1–60 minutos. Calcula los índices por horas transcurridas, fechas locales o años locales, según la recurrencia, y revisa las candidatas alrededor de ambos extremos. Se elimina el límite vitalicio y la aproximación anual por segundos. Las series futuras no generan recordatorios prematuros.

Se comprueba el módulo planning, se eliminan minutos de aviso duplicados del mismo registro y se conserva la exclusión de ocurrencias ya enviadas. No cambia cola, horarios cron, destinatarios ni el mecanismo de envío. La entrega siguiente tratará avisos encolados que quedan obsoletos tras editar la tarea.

## Validación y despliegue

32 pruebas pasan en siete archivos: expansión antigua diaria/horaria, más de 200 ocurrencias dentro de un mes, claves estables, rango vacío, años futuros/bisiestos, paridad SQL/JS en DST y tipos de recurrencia, cola/idempotencia, permisos y módulo; regresiones de recordatorios, movimientos y rango del calendario. La paridad se verifica con los motores reales Intl y PostgreSQL de PGlite, no con mocks de fechas de transición.

Aplicar PLANNING_RECURRENCE_WINDOW.sql después de PLANNING_REMINDER_PAYLOAD_FIX.sql y COMPANY_MODULES.sql; no volver a aplicar después definiciones anteriores de due_planning_reminders. Publicar el panel. No requiere redesplegar Edge ni modificar cron; la firma RPC se conserva. La migración no envía emails por sí sola, pero el cron existente podrá encolar los avisos actuales de series antiguas que antes se omitían.

Antes de producción revisar las series activas y el volumen previsto de avisos; comprobar en un entorno controlado que solo se encolan las ocurrencias actuales y que navegar por semanas/meses antiguos y futuros conserva claves y fechas. Pendiente revisión nativa/visual móvil, tablet y escritorio en el entorno desplegado. Los contadores del resumen semanal y los avisos obsoletos pertenecen a otras entregas del roadmap.
