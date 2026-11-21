# Resumen semanal: recuperación acotada

Entrega 14 de la auditoría, hallazgo 13. Corrección local; SQL y Edge pendientes de despliegue coordinado.

El bloqueo anterior se renovaba al reclamar un envío y permitía recuperar trabajos después de que hubiera caducado su clave idempotente. Resend conserva las claves durante 24 horas, según su [documentación oficial](https://resend.com/docs/dashboard/emails/idempotency-keys). Una nueva petición después de ese plazo puede enviar otro correo.

`WEEKLY_SUMMARY_RETRY_WINDOW.sql` añade `first_attempt_at`, fijado una sola vez al reclamar. La recuperación conserva UUID, generación y clave `weekly-summary/<queue-id>/<generation>`; no prolonga el plazo de 20 horas desde ese primer intento. El lease de trabajo dura 10 minutos y el presupuesto sigue siendo de ocho intentos. La petición a Resend se aborta a los 15 segundos. Un timeout no prueba que el proveedor no aceptara el correo: cualquier recuperación continúa sujeta a la misma clave y fecha límite.

El payload y una RPC exclusiva de servicio comprueban el plazo. La Edge vuelve a validar estado, generación, configuración habilitada y lease inmediatamente antes de enviar; si la validación falla, no contacta al proveedor. Los trabajos fuera de plazo o con ID de proveedor quedan `dead/sent_marker_failed`. Una aceptación conocida seguida de fallo del marcador tampoco autoriza otro envío. Una confirmación tardía con ID de proveedor puede consolidarse como `sent` aunque el guard ya hubiera puesto el trabajo en revisión.

Los intentos heredados se fechan con `created_at`, un límite inferior conservador: el timestamp del último lock no permite reconstruir el primer intento. Esto puede retirar de la recuperación automática trabajos antiguos que nunca llegaron al proveedor. Los trabajos nunca intentados reciben la fecha actual cuando se reclaman por primera vez.

## Despliegue

1. Pausar el scheduler del resumen semanal y esperar a que terminen las invocaciones en curso. Registrar su configuración para restaurarla.
2. Aplicar la nueva migración después de las migraciones existentes del resumen, incluida `WEEKLY_SUMMARY_EMAIL_DELIVERY_FIX.sql` cuando esté instalada. La corrección conserva su cast de emails a `text[]`; no requiere activar ni repetir el circuito Watch.
3. Desplegar `send-weekly-summary` con la configuración de autenticación por secreto ya existente. El worker nuevo falla cerrado si aún falta la RPC de validación, pero el worker antiguo no debe coexistir con la nueva política de recuperación.
4. En un entorno controlado, verificar recuperación dentro del plazo, denegación fuera de plazo y caída tras aceptación. Contrastar grants efectivos y concurrencia con varias conexiones PostgreSQL; PGlite no acredita esas carreras ni el comportamiento real de Resend.
5. Restaurar el scheduler y revisar resultados y estados sin registrar destinatarios ni contenido privado. No ejecutar la rama `watch_test` como comprobación de esta entrega.

## Envíos inciertos

Revisar `dead/sent_marker_failed` contra la evidencia del proveedor. No borrar la fila, reiniciar `first_attempt_at`, cambiar UUID/generación ni volver a encolar para sortear el plazo. Si existe evidencia de entrega, consolidar el resultado mediante el circuito de servicio y su ID de proveedor. Un reenvío nuevo requiere una decisión explícita después de revisar la entrega anterior.

Las métricas y destinatarios se recalculan al recuperar. Si el proveedor rechaza una clave reutilizada con contenido distinto, no sustituirla por otra para forzar el envío; revisar el estado. La exactitud de los conteos pertenece a la entrega 18 del roadmap.

## Evidencia local

32 pruebas en cuatro archivos: ventana fija, backfill heredado, lease vencido, generación, permisos anónimo/autenticado/servicio, límites, backoff, ID conocido, confirmación tardía, fallo de marcador y timeout del handler real. ESLint de los dos tests JS pasa; 13/13 Edge Functions compilan. Proveedor, cron y SQL remoto no ejecutados en esta entrega.

Comprobación de whitespace de esta entrega correcta. La comprobación global de Git detecta espacios en el PDF del manual previamente modificado, ajeno a esta corrección; se conserva ese archivo.
