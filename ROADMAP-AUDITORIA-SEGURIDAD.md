# Correcciones de auditoría · 28/10/2026

Alcance autorizado: hallazgos 1–21 del informe del chat. El 22 (tamaño del bundle) queda excluido. Los números siguientes conservan la correspondencia con el informe; el orden prioriza aislamiento, exposición y efectos económicos antes de fiabilidad y operación.

Cada entrega exige revalidar el hallazgo contra el código actual, conservar cambios existentes, pruebas de éxito y denegación, documentación y estado de despliegue. Una corrección local no acredita que producción esté protegida. Nuevos cambios SQL irán en nuevas migraciones, sin reescribir las aplicadas.

## Orden de entregas

| Orden | Hallazgo | Análisis y criterio de cierre | Estado local |
|---|---|---|---|
| 1 | 1 · Borrado cruzado de Storage | Acotar proyecto, empresa e item antes de usar service_role; cubrir URLs firmadas, codificadas, ajenas y antiguas. | Validado localmente; pendiente despliegue |
| 2 | 2 · RPC de portadas | Autorizar rol/empresa/módulo y pertenencia de la media; comprobar anonimato, empresas distintas y cambio atómico. | Validado localmente; pendiente aplicar SQL |
| 3 | 3 · Vista de media | Revisar privilegios efectivos y usar RLS del invocador; mantener lectura pública de publicados y denegar borradores ajenos. | Validado localmente; pendiente aplicar SQL |
| 4 | 6 · RPC de analítica | Restringir agregación y purga al ejecutor necesario; conservar cron y actualización autorizada. | Validado localmente; pendiente aplicar SQL |
| 5 | 5 · Empresa en tracking | Fijar tenant del despliegue; probar identificador manipulado y eventos válidos. | Validado localmente; pendiente redesplegar webs |
| 6 | 8 · Módulos y RPC | Inventariar entradas privilegiadas; bloquear lecturas y escrituras con módulo desactivado conservando aislamiento. | Validado localmente; pendiente aplicar SQL |
| 7 | 4 · Rectificativas y saldos | Definir consolidación por sustitución/diferencia, cobros previos, créditos y rectificaciones sucesivas; alinear panel y recordatorios sin alterar documentos emitidos. | Validado localmente; pendiente SQL/panel |
| 8 | 9 · Validación de identidad | Restaurar validación acumulativa de perfiles, paletas y logos; probar orden completo de migraciones y documentos antiguos. | Validado localmente; pendiente aplicar SQL |
| 9 | 10 · Formularios anidados | Separar la acción de guardar plantilla; verificar que no persiste presupuesto ni cambia su estado. | Validado localmente; pendiente publicar panel |
| 10 | 7 · Importación Excel | Seleccionar distribución mantenida y verificar avisos, licencia e integración; limitar archivos y cubrir importaciones válidas/hostiles. | Validado localmente; pendiente publicar panel |
| 11 | 16 · Spam en leads | Definir control servidor de frecuencia y coste, sin confiar en honeypot u origen; probar límites, concurrencia y tenant. | Validado localmente; pendiente SQL/webs y concurrencia real |
| 12 | 11 · Recurrencias | Calcular por intervalo visible/vigente en lugar de truncar la vida de la serie; alinear SQL, zona horaria y cambios de hora. | Validado localmente; pendiente SQL/panel |
| 13 | 12 · Avisos obsoletos | Invalidar o revalidar cola al editar fechas, recurrencia y avisos; cubrir reintentos y carreras. | Validado localmente; pendiente SQL/Edge coordinados |
| 14 | 13 · Resumen duplicado | Impedir reenvío incierto fuera de ventana del proveedor; probar caída tras aceptación y recuperación tardía. | Validado localmente; pendiente SQL/Edge coordinados |
| 15 | 14 · Directorio compartido | Definir acceso al cliente con billing o planning, sin ampliar permisos del resto de Planning. | Validado localmente; pendiente SQL/panel |
| 16 | 17 · Archivos huérfanos | Diseñar limpieza verificable al borrar items con rutas autorizadas, reintentos y sin eliminar referencias compartidas. | Validado localmente; pendiente SQL/Edge/cron |
| 17 | 15 · Reconstrucción SQL | Completar bootstrap reproducible desde BD vacía y documentar requisitos/grants/extensiones; no ejecutar snapshot de referencia a ciegas. | Validado localmente; pendiente Supabase real |
| 18 | 18 · Métricas semanales | Contar primera emisión y ocurrencias reales; probar creación emitida, edición+emisión, pagos/reversiones y recurrencias. | Validado localmente; pendiente SQL/Edge |
| 19 | 19 · Búsqueda de privacidad | Usar comparación telefónica solo con dígitos; escapar comodines y verificar búsqueda exacta sin contactos ajenos. | Validado localmente; pendiente SQL |
| 20 | 20 · Invitaciones | Representar creación y entrega por separado; recuperación segura sin duplicar usuarios o membresías. | Validado localmente; pendiente SQL/Edge/panel |
| 21 | 21 · Paginación de usuarios | Recorrer páginas con control de errores; verificar usuarios posteriores a la primera y autorización administrativa. | Validado localmente; pendiente Edge |

## Validación y despliegue de la entrega 1

- [x] Pruebas del handler real con Supabase simulado: éxito, ruta ajena, usuario sin permisos y fallo de BD.
- [x] `npm run check:functions`: 13/13 funciones compilan.
- [x] Registrar resultados y límites en Features.md.
- [ ] Desplegar `delete-item-media` y verificar en entorno controlado con dos empresas.

No requiere migración SQL ni cambios de frontend. Desplegar con `supabase functions deploy delete-item-media` en el proyecto correcto después de revisar la configuración. Las URLs sin pertenencia verificable permiten retirar el registro autorizado y devuelven aviso de limpieza omitida; sus objetos requieren revisión manual. Nunca ampliar la aceptación de rutas antiguas sin acreditar su propiedad.

## Comprobaciones transversales pendientes

Contrastar migraciones/grants/RLS efectivos en Supabase (incluidas attached_file y client_company_members), versiones Edge, buckets, cron y snippets desplegados. Registrar por separado fallos previos de lint/tests; no atribuirlos a entregas nuevas ni dar por cerrado el despliegue con una compilación local.

## Entrega 2 · RPC de portadas

- [x] Nueva migración `ITEM_MEDIA_COVER_SECURITY.sql`, sin modificar SQL previamente aplicado.
- [x] Autenticación, rol activo, módulo, pertenencia de imagen y bloqueos para serializar cambios.
- [x] Seis pruebas SQL con PGlite y el validador real de media: éxito, permisos, pertenencia, suspensión/módulo, idempotencia y rollback tras fallo de asignación.
- [x] Documentación de orden y despliegue en database/README.md y decisiones en Features.md.
- [ ] Aplicar migración y validar permisos efectivos en un entorno controlado y producción.

La serialización está implementada con bloqueos del item y sus medias; la prueba local no reproduce múltiples conexiones concurrentes de producción. El siguiente punto es la vista `item_media_summary` (hallazgo 3).

## Entrega 3 · Vista de resúmenes de media

- [x] Nueva migración `ITEM_MEDIA_SUMMARY_SECURITY.sql`: `security_invoker=true`, permisos explícitos de lectura y contrato de columnas conservado.
- [x] Seis pruebas SQL con RLS/policies reales de items y media: reproducción previa, anónimos, roles y empresas, IDs adivinados, bajas, módulos desactivados e items sin media.
- [x] Documentación de requisitos y despliegue; decisiones en Features.md.
- [ ] Aplicar migración y contrastar RLS/grants efectivos en entorno controlado y producción.

Requiere PostgreSQL 15 o superior y las políticas base y de módulos indicadas en database/README.md. El siguiente punto del roadmap es restringir las RPC internas de analítica (hallazgo 6).

## Entrega 4 · RPC internas de analítica (hallazgo 6)

- [x] Nueva migración `ANALYTICS_RPC_SECURITY.sql`: revocar ejecución pública/anónima/autenticada de agregación y purga, conservar propietario y conceder service_role; fijar search_path.
- [x] RPC manual limitada a usuario autenticado autorizado, empresa concreta, día actual y módulo analytics habilitado.
- [x] Cinco pruebas SQL con los cuerpos reales: reproducción previa, denegaciones, aislamiento, idempotencia, bajas/módulos, mantenimiento y retención.
- [x] Documentar despliegue y decisiones en database/README.md y Features.md.
- [ ] Verificar usuario de cron y permisos efectivos, aplicar migración y validar en entorno controlado/producción.

PGlite ejecuta las sentencias de mantenimiento, no el scheduler pg_cron real. El siguiente punto es fijar la empresa en el endpoint de tracking (hallazgo 5).

## Entrega 5 · Empresa del endpoint de tracking (hallazgo 5)

- [x] Validar UUID configurado en servidor y rechazar empresa distinta antes de acceso a BD/caché.
- [x] Usar exclusivamente la empresa configurada para definiciones, existencia e inserción.
- [x] Seis pruebas del handler real con núcleo de tracking real y Supabase simulado: aislamiento, configuración inválida, eventos válidos, caché caliente, otras instancias y validaciones existentes.
- [x] Documentar configuración de servidor y redespliegue de cada web.
- [ ] Actualizar snippet/configuración y verificar eventos en las webs desplegadas.

No requiere SQL ni cambio en Edge. Siguiente entrega: revisar módulos y RPC privilegiadas (hallazgo 8).

## Entrega 6 · Bloqueos de módulos en RPC privilegiadas (hallazgo 8)

- [x] Inventariar controles comunes, lecturas privilegiadas, escritura protegida por triggers y mantenimiento service_role.
- [x] Nueva migración COMPANY_MODULES_RPC_COMPLETION.sql: controles comunes de Facturación y privacidad CRM, finanzas, listados/reintentos de avisos y acceso a objetos Planning.
- [x] Exportación CRM sin documentos de billing desactivado, indicada mediante billing_module_enabled en el JSON.
- [x] Seis pruebas SQL nuevas y regresión de borradores/rectificativas: 14 pruebas pasan; ESLint del nuevo test pasa.
- [ ] Aplicar nueva migración tras sus dependencias y probar permisos reales en entorno controlado/producción.

Inventario y límites en docs/auditoria-modulos-rpc.md. Siguiente entrega: saldos de rectificativas (hallazgo 4); esta entrega no modifica su cálculo.

## Entrega 7 · Saldos de rectificativas (hallazgo 4)

- [x] Cálculo consolidado por familia, última sustitución, diferencias posteriores y cobros/reversiones una sola vez.
- [x] Bloqueo de raíz para rectificar/cobrar/revertir; nuevos cobros sobre documento vigente; idempotencia conservada.
- [x] Encolado/reclamación/payload de avisos usan saldo consolidado y excluyen documentos anteriores.
- [x] Panel ES/EN: filtro Rectificadas, explicación de consolidación e importe a favor por exceso cobrado.
- [x] Pruebas SQL y componentes, compilación y lint de los archivos modificados.
- [ ] Aplicar migración, publicar panel y validar datos/volumen/concurrencia en entorno controlado y producción.

Decisión, ejemplos y límites: docs/rectificativas-saldos.md. Siguiente entrega: validación de identidad visual (hallazgo 9).

## Entrega 8 · Validación de identidad visual (hallazgo 9)

- [x] Nueva migración BILLING_PROFILE_VALIDATION_REPAIR.sql: restaurar validación de paleta, contraste, base64 y firmas PNG/JPEG conservando rectificationPrefix.
- [x] Siete pruebas SQL tras la cadena de facturación: reproducción previa, perfiles/documentos históricos, entradas inválidas, perfiles válidos, paletas, series, rectificativas y aislamiento.
- [x] Regresión de apariencia, paletas y rectificativas: 28 pruebas pasan en cinco archivos; ESLint del nuevo test pasa.
- [x] Decisiones y orden de aplicación documentados.
- [ ] Aplicar SQL y revisar perfiles/documentos heredados inválidos en entorno controlado/producción.

La migración solo cambia la validación de nuevas escrituras; no reescribe perfiles ni documentos. Siguiente entrega: formularios anidados en plantillas de capítulos (hallazgo 10).

## Entrega 9 · Guardado independiente de plantillas (hallazgo 10) · 29/10/2026

- [x] Eliminar el formulario anidado; botón de plantilla type=button y acción local con validación ES/EN.
- [x] Enter en nombre guarda solo plantilla; Enter en búsqueda no envía presupuesto. Evitar peticiones duplicadas y bloquear acciones deshabilitadas.
- [x] Conservar nombre al fallar y permitir reintento; nombre de plantilla vacío no bloquea el presupuesto.
- [x] 49 pruebas de componente/editor pasan; compilación y lint de los archivos modificados correctos.
- [ ] Publicar panel y verificar interacción nativa por teclado en el entorno desplegado.

Sin SQL ni cambios Edge. Se conserva la disposición CSS existente. La integración prueba guardado de plantilla sin persistir documento/cambiar ruta y posterior guardado explícito del presupuesto. Happy DOM requiere el ajuste ya usado en otras pruebas para pasos decimales; no equivale a una revisión visual en navegador real. Siguiente entrega: importación Excel (hallazgo 7).

## Entrega 10 · Importación Excel (hallazgo 7) · 29/10/2026

- [x] SheetJS 0.20.3 oficial fijado en vendor con hash/licencia y lockfile; retirada versión 0.18.5 y dependencias exclusivas antiguas.
- [x] Parser en worker con timeout/cancelación; límites de bytes, metadatos ZIP, filas y columnas.
- [x] Validación atómica de cabeceras, tipos, nombres/duplicados, indicadores y fórmulas.
- [x] Errores ES/EN, borrador conservado al fallar y cancelación por nuevo archivo/reset/cambio de contexto/desmontaje.
- [x] 26 pruebas pasan en cuatro archivos; parser real XLSX/XLS y plantilla exportada, worker simulado y hook. Build y lint de archivos modificados correctos.
- [ ] Publicar panel con worker y paquete vendor; validar interacción en navegador real y configuración CSP externa.

Procedencia, límites y despliegue: docs/importacion-excel-segura.md y admin-panel/vendor/README.md. Sin SQL ni Edge. Siguiente entrega: protección contra spam del endpoint de leads (hallazgo 16).

## Entrega 11 · Protección de leads (hallazgo 16) · 29/10/2026

- [x] Reserva persistente y atómica, cinco por origen/15 minutos y 100 por empresa/hora; sin parámetros de umbral controlados por el cliente.
- [x] Identidad HMAC de IP Vercel, normalización IPv4/IPv6 y agrupación /64; sin IP en claro en buckets.
- [x] Cuerpo acotado a 16 KiB, error cerrado sin backend/configuración y 429 sin insertar ni crear contactos.
- [x] Resultado rate_limited en cliente sin conversión falsa ni pérdida de datos; guía ES/EN y despliegue/retención documentados.
- [x] Pruebas SQL, handler y cliente; comprobación de funciones Edge.
- [ ] Aplicar SQL/secreto, actualizar webs y verificar varias conexiones simultáneas, proxy y job de purga reales.

Las pruebas SQL locales son serializadas; la exclusión entre instancias se implementa con bloqueo transaccional de empresa y requiere contraste remoto. Siguiente entrega: recurrencias (hallazgo 11).

## Entrega 12 · Recurrencias por intervalo (hallazgo 11) · 29/10/2026

- [x] Expansión por rango visible, búsqueda directa por índice y claves estables; sin límite vitalicio de 200 ni horizonte de tres años.
- [x] Hora de Madrid para días/semanas/años, tiempo transcurrido para horas y fechas sin hora para billing_date.
- [x] Nueva migración PLANNING_RECURRENCE_WINDOW.sql: candidatas por ventana, módulos, permisos y deduplicación conservados.
- [x] Periodo de importes de Planning visible en ES/EN.
- [x] 32 pruebas pasan en siete archivos, incluidos motores SQL/JS, cambios de hora, años bisiestos y cola; compilación y lint de archivos modificados correctos.
- [ ] Aplicar SQL, publicar panel y validar series/volumen y navegación en entorno controlado/producción.

Reglas y límites en docs/recurrencias-por-intervalo.md. Siguiente entrega: avisos obsoletos al modificar tareas (hallazgo 12).

## Entrega 13 · Avisos de tareas modificadas (hallazgo 12) · 29/10/2026

- [x] task_version en cola e invalidación tras actualizar tarea.
- [x] Validación SQL del snapshot/empresa/ocurrencia/minutos/módulo inmediatamente antes del envío Edge.
- [x] Rearme solo de trabajos nunca intentados; bloqueo de reintentos manuales obsoletos y confirmación tardía preservada.
- [x] 30 pruebas pasan en cinco archivos, lint de tests JS y 13/13 Edge Functions compilan.
- [ ] Conciliar intentos heredados y desplegar SQL/worker con scheduler pausado, comprobando concurrencia real.

Reglas y limitación del correo ya en vuelo en docs/planning-avisos-obsoletos.md. Siguiente entrega: recuperación segura del resumen semanal (hallazgo 13).

## Entrega 14 · Resumen semanal duplicado (hallazgo 13)

- [x] Nueva migración `WEEKLY_SUMMARY_RETRY_WINDOW.sql`: primer intento fijo, plazo de 20 horas, lease de 10 minutos y cuarentena de resultados inciertos; clave y generación conservadas.
- [x] Validación exclusiva de servicio inmediatamente antes del proveedor y timeout de 15 segundos; confirmaciones tardías con ID conservadas sin reenvío.
- [x] 32 pruebas en cuatro archivos, lint de tests JS y 13/13 Edge Functions compilan.
- [x] Despliegue coordinado y tratamiento conservador de intentos heredados documentados en `docs/weekly-summary-retry-window.md`.
- [ ] Pausar scheduler, esperar workers, aplicar SQL y Edge y validar permisos/concurrencia/proveedor en entorno controlado antes de restaurar cron.

Siguiente entrega: directorio de clientes compartido entre Facturación y Planning (hallazgo 14). El hallazgo 22 sigue excluido.

## Entrega 15 · Directorio compartido (hallazgo 14)

- [x] Reproducidos los bloqueos previos de lectura/escritura con un solo módulo activo.
- [x] Nueva migración `CLIENT_DIRECTORY_MODULE_ACCESS.sql`: RLS y trigger exclusivos del directorio, RPC con roles y módulo Planning o Facturación, sin escrituras directas ni helpers públicos.
- [x] Ruta/menú alineados y enlace a Planning condicionado a su módulo; componentes y traducciones existentes.
- [x] 44 pruebas SQL/DOM/servicios en siete archivos, lint de archivos modificados y build correctos.
- [ ] Aplicar SQL, publicar panel y comprobar permisos reales y navegación en móvil/tablet/escritorio con dos empresas.

Matriz y límites en `docs/directorio-clientes-compartido.md`. Siguiente entrega: limpieza verificable de archivos huérfanos al borrar items (hallazgo 17). El 22 permanece excluido.

## Entrega 16 · Archivos de items eliminados (hallazgo 17)

- [x] Cola y respaldo del padre transaccionales para borrado de items, cascadas y borrado individual de media.
- [x] Worker exclusivo: origen/propiedad de ruta, comprobación de referencias, lease/token, backoff y máximo de intentos.
- [x] Marcadores persistentes serializados con nuevas referencias de media/blog; sin borrado físico directo desde el endpoint individual.
- [x] 36 pruebas SQL/Edge y regresiones en cinco archivos, lint de tests y compilación 14/14 funciones.
- [ ] Aplicar SQL, desplegar las dos Edge, configurar secreto/cron y verificar Storage y concurrencia reales antes de reabrir operaciones.

Circuito, fuentes de referencias protegidas y límites en `docs/limpieza-storage-items.md`. No realiza un barrido de objetos históricos que ya perdieron su vínculo. Siguiente entrega: reconstrucción SQL reproducible desde una base vacía (hallazgo 15). El 22 sigue excluido.

## Entrega 17 · Reconstrucción SQL (hallazgo 15)

- [x] Cinco tablas históricas ausentes en bootstrap, dependencias y permisos explícitos; fuentes anteriores conservadas.
- [x] Manifiesto de 65 pasos, generador con SHA-256, clasificación completa de migraciones y validación de fuentes/secciones; no ejecuta SQL ni sobrescribe artefactos.
- [x] Cron, Watch, demos, snapshots y reparaciones de datos fuera del flujo automático.
- [x] 24 pruebas de reconstrucción, flujos/denegaciones, generador y coherencia del runbook; sintaxis del generador y lint de tests correctos.
- [ ] Aplicar sobre Supabase descartable real y verificar Auth/REST/Storage, grants/extensiones y activación posterior de workers/cron antes de producción.

Procedimiento y límites en `docs/bootstrap-supabase.md`. Siguiente entrega: conteos del resumen semanal (hallazgo 18). El hallazgo 22 continúa excluido.

## Entrega conjunta 18–21 · 29/10/2026

- [x] Métricas: primera emisión verificable, familias rectificadas con saldo y ocurrencias recurrentes por semana de Madrid; alcance histórico explicado en el correo.
- [x] Privacidad: búsqueda literal, teléfono solo con entrada telefónica y aislamiento/autorización conservados.
- [x] Invitaciones: estado persistente, recuperación explícita sin duplicar cuentas/membresías, permisos de servidor, conservación de campos y mensajes ES/EN.
- [x] Usuarios: paginación completa con deduplicación, errores cerrados y administrador validado antes de consultar Auth.
- [x] Reconstrucción canónica actualizada a 68 pasos y pruebas focalizadas SQL/handlers/DOM/servicios/regresiones.
- [ ] Aplicar las tres migraciones, desplegar invite-user/listar-usuarios/send-weekly-summary y publicar panel; validar en Supabase real y buzones controlados.

Procedimiento, contrato y límites en `docs/auditoria-cierre-18-21.md`. Los hallazgos 1–21 tienen corrección local; siguen pendientes los despliegues y comprobaciones remotas indicados en cada entrega. El 22 permanece excluido por petición del usuario.

## Revisión posterior · correcciones adicionales

- [x] Rol/nombre pendientes actualizados antes de crear membresía; regresión SQL del cambio editor a viewer.
- [x] Alta con contraseña recuperable, sin borrado compensatorio ni cambio de credenciales existentes; resultado parcial y UI ES/EN.
- [x] Alineación de pruebas de módulos y correos; retirada del efecto de reinicio SEO que bloqueaba lint.
- [ ] Aplicar COMPANY_USER_PROVISIONING_RECOVERY.sql, desplegar create-user/panel y validar servicios reales.

Procedimiento: docs/correcciones-revision-posterior.md.
