# Entornos y recuperación de facturación

## Estado de despliegue · 26/10/2026 [P15]

Implementación y tests locales; sin migraciones aplicadas en Supabase, trabajos programados ni despliegues. El inventario completo de entornos, backup y puertas de lanzamiento continúa pendiente. El código local no certifica producción.

## Retención

| Recurso | Ámbito | Retención y limpieza |
|---|---|---|
| Recuperación `sessionStorage` | Usuario/empresa/tipo/documento | Hasta 24 h; máximo 10 entradas y 3 MiB del namespace. Evicción de caducadas/antiguas; cierre de sesión/cambio de usuario confirmado limpia copias locales. El navegador puede perderlas al terminar sesión. |
| `billing_drafts` | Propietario/empresa con permiso activo de edición | 30 días desde última escritura aceptada. RLS/RPC excluyen caducadas; purga para eliminación física. |
| `billing_draft_events` | Metadatos mínimos de mantenimiento | 90 días; sin contenido fiscal ni lectura del cliente. |
| `billing_draft_commits` | Petición confirmada por propietario/empresa/tipo | 30 días; reconoce guardados cuya respuesta se perdió. |

No se guardan credenciales en recuperación. Los borradores pueden contener datos fiscales: no exportarlos a logs o capturas reales. La exportación JSON es una acción del usuario. Una comprobación de sesión fallida no borra copias; una salida confirmada detiene controladores antes de limpiar para impedir reescrituras al desmontarse.

## Despliegue pendiente

1. Inventariar migraciones aplicadas y comprobar backup/restauración en entorno de prueba. Conservar datos y migraciones aplicadas.
2. Validar `INVOICING → QUOTES → BILLING_SECURITY_HARDENING → BILLING_DOCUMENT_PRESENTATION → BILLING_APPEARANCE` y, después, `BILLING_NAMED_PALETTES`, `BILLING_DRAFTS`, `BILLING_DIRECTORY_CATALOG`, `BILLING_CHAPTER_TEMPLATES` y `BILLING_PAYMENTS_HISTORY` mediante CLI/CI autorizado. Estas ampliaciones están comprobadas localmente y pendientes en destino.
3. Programar diariamente `select public.purge_billing_recovery();` bajo propietario SQL/service_role con el mecanismo autorizado del entorno. La migración no crea cron. No poner claves en SQL, comandos almacenados ni frontend; usar gestor de secretos. Registrar fallos y verificar purga con datos ficticios caducados. Sin job activo solo hay caducidad lógica, no eliminación física periódica.
4. Desplegar panel después del contrato SQL; no requiere funciones Edge nuevas. Sin las RPC la UI avisa y conserva guardado manual.
5. Smoke autenticado por tipo: documento incompleto, recarga/recuperación, fallo/reintento, dos pestañas en conflicto, guardado explícito sin duplicados, caducidad y logout. Dos compañías, dos usuarios de una compañía, lector e inactivo: no acceder a copias ajenas. Verificar documentos antiguos y numeración.
6. Registrar resultados reales antes de certificar lanzamiento. Revertir frontend conserva tablas/documentos; no borrar recuperación como rollback. Restaurar backup requiere procedimiento autorizado y comprobación previa en pruebas.

PGlite y servicios simulados no validan credenciales, configuración de producción, cron real, sesiones remotas ni restauración de backup. Contratos en `facturacion-datos.md`; evidencia en `testing.md`.

## Observabilidad Supabase · P10

La captura del 24/10/2026 muestra 0,02 GB de 1 GB de Log Ingestion y 12,40 GB de 100 GB de Log Query, sin overage. No justifica reducir el logging de PostgreSQL ni cambiar la configuración de plataforma. La diferencia indica principalmente que se han leído muchas más filas de log de las que se generan; en Studio conviene acotar primero el intervalo temporal y añadir filtros antes de repetir consultas.

Las Edge Functions deben emitir solo códigos de error estables y mínimos, sin cabeceras, tokens, emails, URLs, IDs de usuario/tarea ni objetos de proveedor. `npm run check:functions` compila las funciones y falla si encuentra `console.log`, `console.info` o `console.debug`. Antes de desplegar las funciones modificadas, revisar los diffs, probar errores con datos ficticios y confirmar que los códigos permiten diagnosticar sin contenido personal.

## Diagnóstico local del panel · P15

`reportOperationalFailure(scope, code, error)` registra fallos de facturación y gestión de usuarios con una lista cerrada de áreas/códigos, entorno, versión, tipo de error estándar y hora. No incluye el mensaje, stack, respuesta HTTP, usuario, empresa, email, URL ni contenido del documento. Vite toma `VERCEL_ENV` y `VERCEL_GIT_COMMIT_SHA` durante un build de Vercel; local usa `local` para entorno/versión. `VITE_DEPLOYMENT_ENV` y `VITE_APP_VERSION` permiten sobrescribirlos. El workflow GitHub fija `ci` y el SHA para build/test.

Estos eventos salen únicamente a la consola del navegador. No hay proveedor centralizado de errores ni envío de telemetría del panel en esta entrega; por tanto la consola no se considera monitorización operativa. Conectar un colector requiere elegir y autorizar proveedor, definir retención y probar la redacción del payload antes de activar egress. Los errores de recordatorios ya usan códigos estables en la Edge Function y la cola; su consulta operacional se hace desde Planning → Avisos.

No hay agregación persistente de métricas de operaciones en el panel ni destino central acordado. La decisión actual es no transmitir telemetría desde el navegador mientras falten proveedor, retención y revisión del payload. La consola local y los logs de Edge son diagnóstico técnico, no métricas de producto ni una alerta monitorizada. Al inventariar producción, confirmar también retención/acceso de Vercel, Supabase y backups con la configuración real del proyecto; este repositorio no fija esos plazos.

## Operación de Planning y cola de correos · P14 parcial

`PLANNING_EMAIL_QUEUE.sql` limita los códigos de fallo y no guarda dirección ni contenido del email. El código Edge local ya consume la cola; después de desplegar migración y función, programar una purga diaria de `select public.purge_planning_email_queue();` con service_role en el entorno autorizado: enviados >90 días y fallidos/saltados >180 días. No se habilita cron automáticamente. Planning → Avisos muestra la cola por empresa; las RPC de lectura y reintento aplican permiso por compañía y rol.

El repositorio ya contiene CI de pull request/push con ESLint global del panel, pruebas, build, comprobación de salida y compilación de Edge Functions. `npm run lint` pasa localmente sin errores ni avisos. No incluye E2E autenticado, navegador/capturas, axe/Lighthouse, escaneo externo ni backup/restore; la verificación del workflow en GitHub y los proveedores/DNS siguen pendientes. La salida de build debe excluir `.design-preview`, `design-preview.html` y source maps; el script lo comprueba.
