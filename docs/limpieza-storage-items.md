# Limpieza de Storage al borrar items · entrega 16

Corrección local del hallazgo 17. No se han borrado objetos remotos, ejecutado SQL remoto ni activado cron.

Antes, `items` borraba `item_media` por cascada y el trigger emitía un NOTICE con la URL, sin ejecutar ni conservar la limpieza. El borrado individual dependía de una llamada posterior a Storage: un fallo dejaba un objeto sin trabajo recuperable.

## Circuito

`ITEM_STORAGE_CLEANUP_QUEUE.sql` crea una cola privada. Un trigger BEFORE DELETE conserva empresa/item y captura las medias bajo bloqueo; el trigger de cada media cubre el borrado directo y recoge la empresa desde el respaldo si el padre ya no es visible. La cola y el respaldo pertenecen a la misma transacción: un rollback del borrado también los revierte. No se borran filas de `storage.objects` mediante SQL.

La cola conserva IDs y una URL sin query ni fragmento. Rutas malformadas, credenciales en la URL, nombres fuera del formato conservador y namespaces que no pertenecen al item van a revisión sin guardar esa URL. El worker contrasta además el origen con `SUPABASE_URL` mediante el helper de propiedad existente. Nunca acepta un bucket o una ruta enviados en el cuerpo de la petición.

`cleanup-item-media` requiere POST y un secreto de cron exclusivo. Reclama hasta 20 trabajos, con lease de 10 minutos, token nuevo por reclamación y máximo de ocho intentos. Comprueba de nuevo el token y las referencias antes de tocar Storage. Todas sus peticiones a Supabase llevan timeout de 15 segundos. Los fallos usan backoff de 30 segundos hasta una hora; una caída tras borrar el objeto se recupera repitiendo el borrado idempotente sobre la misma ruta.

Las referencias protegidas son `item_media`, `blog_media` y los enlaces del cuerpo de `blog_posts`, incluidas referencias de otras empresas, borradores o módulos desactivados. Se reconocen variantes públicas/firmadas, codificación y segmentos de ruta normalizados. Los enlaces de texto se comparan de forma conservadora: una coincidencia dudosa puede conservar un archivo y exigir revisión.

Antes de eliminar se registra `retired_at`, una marca persistente de la ruta. Los triggers de las fuentes anteriores bloquean nuevas referencias a una ruta retirada y se serializan con su trabajo mediante bloqueos de fila. El marcador no se borra al reintentar ni al finalizar. Así, una referencia nueva no puede incorporarse entre la comprobación y la llamada externa. Esto no constituye un registro universal de enlaces: URLs copiadas a sistemas externos u otros campos de texto fuera de estas fuentes requieren revisión específica antes de automatizar su limpieza.

`delete-item-media` conserva autorización y borrado del registro, pero deja la eliminación física al worker. Devuelve `cleanup: deferred` para las rutas verificables o `review` si no lo son; la clasificación final es la de la cola. El borrado de items por REST queda cubierto por SQL, sin cambios en el panel.

## Despliegue coordinado

1. Revisar backups, esquema, triggers y permisos efectivos. Requiere las tablas base de items/blog, `ITEM_MEDIA_STORAGE.sql`, helpers de membresía activa y módulos. Comprobar los grants/RLS reales de Storage.
2. Pausar temporalmente las operaciones de borrado/subida y esperar a que terminen las invocaciones anteriores. La Edge antigua elimina directamente y no debe coexistir con el nuevo circuito durante el cambio.
3. Aplicar `ITEM_STORAGE_CLEANUP_QUEUE.sql`; desplegar `delete-item-media` y `cleanup-item-media`. El worker tiene `verify_jwt=false` en configuración y valida su propio secreto. No reaplicar después el placeholder antiguo de limpieza.
4. Configurar `ITEM_MEDIA_CLEANUP_CRON_SECRET` en Edge y el mismo valor en Vault como `item_media_cleanup_cron_secret`. Crear `item_media_cleanup_function_url` con la URL de esa función en el proyecto correcto. No poner secretos en archivos ni frontend.
5. Con `pg_cron`, `pg_net` y Vault disponibles, aplicar `ITEM_STORAGE_CLEANUP_CRON.sql`: ejecución cada cinco minutos. Sin worker/cron, los registros se borran y los trabajos permanecen pendientes; no considerar operativa la limpieza hasta verificar el circuito completo.
6. Probar en entorno controlado con dos empresas: rutas legítimas y ajenas, referencias compartidas, caída tras Storage, backoff y marcadores. Usar varias conexiones PostgreSQL para verificar concurrencia de FK, referencias y reclamaciones; después restaurar las operaciones habituales.

## Operación y límites

Consultar la cola mediante un operador autorizado: conteos por `status`, `last_error_code`, intentos y antigüedad. No exponer URLs ni el contenido de la cola al navegador. Los estados `review` distinguen rutas no verificadas, referencias compartidas y agotamiento de intentos. No convertirlos indiscriminadamente en pendientes ni eliminar objetos manualmente por coincidencia de nombre.

Si la referencia compartida sigue viva, conservar el objeto. Si se retiró, revisar propiedad, origen, referencias y estado de Storage antes de autorizar un nuevo intento conservando sus identificadores. Los marcadores retirados impiden volver a vincular el mismo path; para nuevas subidas usar un nombre nuevo. No purgar automáticamente los respaldos ni tombstones sin diseñar antes cómo impedir la reutilización de sus rutas.

Los objetos huérfanos anteriores a la migración ya perdieron su relación con el registro y no se incorporan a ciegas. Requieren un inventario separado de Storage y contraste de propiedad/referencias. Tampoco se automatiza aquí la limpieza de subidas que nunca llegaron a registrarse en BD o de URLs sustituidas mediante ediciones anteriores.

## Evidencia local

36 pruebas en cinco archivos: SQL real de captura/cascada/rollback, respaldo del padre, membresías y denegaciones, referencias compartidas y enlaces, rutas retiradas, lease/token/backoff, handlers Edge con Storage simulado y regresión de portadas/vista de media. ESLint de los tests JS correcto y 14/14 Edge Functions compilan. PGlite y mocks no acreditan el comportamiento de Storage, scheduler ni concurrencia del despliegue remoto.
