# Contratos de identidad y recuperación de facturación

Revisión local del 26/10/2026. Incluye contratos de fases 2 y 3 del MVP y políticas de fase 8B/P15. No completa el inventario remoto ni la auditoría general de fase 0/8.

## Métricas operativas y retención · P15

El panel no envía métricas operativas ni errores a un proveedor externo. El registro local de fallos contiene solo área/código controlados, entorno, versión, tipo estándar de excepción y hora; excluye datos fiscales, nombre/email, IDs, URL, payload, mensaje y stack. La salida de consola del navegador no es un almacén de métricas ni un sistema de alertas.

Contrato de métricas si se aprueba un colector: solo contadores agregables con categorías cerradas de operación/resultado, entorno y versión. No se incluirán identificadores de usuario/empresa/documento, contenido fiscal, correo, descripciones, IP persistida, URL completa ni texto libre de errores. No se emitirán eventos por documento ni valores proporcionados por el usuario. Antes de habilitarlo se requiere decisión de proveedor, base jurídica/aviso aplicable, retención, acceso, región, eliminación y prueba del payload. Sin esa aprobación no se configura egress ni se considera que haya monitorización centralizada.

La retención implementada en migraciones locales es: borradores de recuperación 30 días desde la última escritura aceptada; eventos técnicos de borrador 90 días; recibos idempotentes de confirmación 30 días; movimientos de cobro e historial documental append-only sin purga automática configurada; cola de recordatorios enviados 90 días y fallidos/saltados 180 días. Las purgas de borradores y emails son funciones SQL, pero no jobs activos. El catálogo, paletas, plantillas, series y documentos no tienen borrado por edad en las migraciones revisadas. Los plazos de borradores/cola son límites técnicos del producto, no una política general de conservación fiscal. No se programa una purga para facturas, rectificativas, cobros o historial hasta acordar el plazo aplicable con contabilidad/asesoría y revisar obligaciones de conservación, bloqueo legal y borrado. Tampoco se presume la retención de logs/backups del proveedor: requiere inventario del entorno real. No se considera la retención validada en producción hasta comprobar el esquema desplegado y verificar ejecución efectiva de sus jobs.

## Persistencia y copias

- `invoice_settings` guarda un `profile` JSON por `company_id`, compartido por facturas y presupuestos. `save_invoice_profile(p_company, p_profile, p_version)` exige versión para evitar sobreescrituras concurrentes.
- La identidad del documento está en `invoices.document.issuer` o `quotes.document.issuer`: `logo`, `color` compatible y `palette` opcional. El logo es una copia PNG/JPEG inline; no referencia un archivo remoto que pueda sustituirse o borrarse después.
- Una paleta tiene exactamente `id`, `accent`, `ink`, `muted`, `paper` y `surface`. IDs: `graphite`, `ocean`, `olive` y `custom`. Colores `#RRGGBB`; texto principal/secundario requieren 4,5:1 sobre papel y superficie. El acento requiere 4,5:1 sobre papel. En las tablas del presupuesto, el renderizador usa texto principal si el acento no contrasta con su superficie.
- Los documentos antiguos sin paleta mantienen su renderizado anterior. Cambiar el predeterminado de la compañía no actualiza documentos existentes. La conversión presupuesto → factura conserva su copia.
- Personalizar actúa sobre el documento en edición. «Guardar diseño para la compañía» copia solo identidad al perfil, conservando datos fiscales y series. «Usar diseño de la compañía» es una acción explícita sobre la copia del documento. Cambiar de fuente fiscal conserva su identidad visual.

## Logo y errores

El navegador comprueba tipo PNG/JPEG, archivo no vacío, máximo 1 MiB, firma binaria, decodificación y dimensiones entre 1 y 4096 px por eje, con timeout de decodificación. Solo reemplaza el logo tras validar; un fallo conserva el anterior y permite reintentar. La imagen se ajusta a su caja sin deformarse; la miniatura usa el papel del documento incluso en modo oscuro.

La validación SQL limita tamaño, formato inline/base64 y firma PNG/JPEG. No incorpora un decodificador completo de imágenes: no debe confundirse esta comprobación con la decodificación del navegador. El renderizador omite una imagen antigua corrupta y mantiene el emisor en texto. No se permiten URLs ni SVG en el perfil.

## Permisos

| Actor | Lectura de empresa | Guardar perfil/documento |
|---|---|---|
| Miembro activo `viewer` | Sí | No |
| Miembro activo `editor` / `admin` | Sí | Sí |
| Administrador de plataforma | Según privilegios del servidor | Según privilegios del servidor |
| Miembro inactivo o usuario ajeno | No | No |

RLS y RPC siguen imponiendo permisos en servidor. La migración de apariencia amplía validación, no permisos. Los helpers de validación no se exponen directamente a `anon`/`authenticated`. El workspace se identifica por usuario, compañía y tipo; se desmonta al cambiar de contexto y descarta respuestas anteriores. Esta entrega no añade almacenamiento local ni cachés de identidad.

`tests/database/billingAppearance.test.js` aplica las migraciones sobre PostgreSQL local (PGlite), prueba snapshots, conversión, datos inválidos y denegaciones para lector, usuario ajeno, editor de otra compañía y membresía inactiva. La matriz remota con sesiones reales sigue pendiente.

## Migración y despliegue

Requisitos: `INVOICING.sql` → `QUOTES.sql` → `BILLING_SECURITY_HARDENING.sql` → `BILLING_DOCUMENT_PRESENTATION.sql` → `BILLING_APPEARANCE.sql`. Esta última ya existía al iniciar P3; no se ha editado ni aplicado a un entorno compartido. No hace falta otra migración para las correcciones de renderizado/ayuda de P3.

Antes de producción: comprobar versiones desplegadas y backup, validar en desarrollo la secuencia mediante el proceso CLI/CI del proyecto, guardar un perfil y un documento de prueba por tipo, comprobar PDF y denegaciones entre empresas, y revisar documentos antiguos. No se considera desplegado por pasar las pruebas locales. Ver `database/README.md`.

## Borradores privados y recuperación · P7

`BILLING_DRAFTS.sql` depende de `BILLING_APPEARANCE.sql`. `billing_drafts` guarda compañía, propietario, tipo, clave, documento parcial, versión original, revisión, token de escritura y caducidad. Clave estable: `new` para un nuevo documento por usuario/empresa/tipo, o UUID de documento existente. No es una biblioteca de varios documentos nuevos simultáneos.

Las copias son privadas incluso entre miembros de la misma compañía. RLS exige propietario y permiso activo editor/admin (o administrador de plataforma); lector, inactivo, ajeno y anónimo quedan excluidos. Sin escrituras directas desde cliente. Las RPC comprueban permisos en cada operación y usan nombres cualificados con `search_path` vacío. El servicio valida usuario/empresa/tipo/clave de respuestas; al cambiar contexto se desmonta el controlador e ignora respuestas tardías.

- `get_billing_draft`: copia vigente o null; con ID de petición anterior puede devolver `completed_record` para abrir el documento ya guardado sin duplicarlo.
- `save_billing_draft`: contenido incompleto tras pausa de 1 s. Valida estructura/límites (2 MB, hasta 1000 líneas, campos acotados y logo inline), sin exigir todos los datos fiscales ni contraste de campos a medio editar. Serializa por ámbito, exige revisión esperada y reconoce token de reintento. No consume números ni emite. Para documentos existentes exige estado borrador y versión original vigente.
- `delete_billing_draft`: descarte explícito con revisión esperada; un conflicto no borra otra copia.
- `commit_billing_draft`: solo desde Guardar tras validación completa. Comprueba copia/revisión/base y llama a `save_invoice` o `save_quote` en la misma transacción; registra resultado y elimina copia. Repetir ID y contenido devuelve el documento ya guardado; contenido distinto o acceso cruzado se rechaza. La numeración sigue perteneciendo al guardado explícito.

El cliente serializa peticiones y conserva entrada actual ante respuestas anteriores. Un conflicto `40001` detiene escrituras y permite revisar/descargar copias; elegir local para sustituir la remota exige acción explícita y otro control de revisión. Recargar o volver ofrece recuperación, nunca aplica copias silenciosamente. Si cambió la versión original solo se permite exportar/descartar. Recuperar restaura siempre estado borrador. Si una confirmación se perdió se ofrece abrir el resultado ya guardado.

`sessionStorage` contiene copia con el mismo ámbito, sin tokens: hasta 24 h, 10 entradas y 3 MiB totales; elimina caducadas/antiguas y tolera almacenamiento bloqueado. Se actualiza tras pausa, confirmación y salida, no cada pulsación. Se limpia al cerrar sesión/cambiar de usuario confirmado, deteniendo controladores para evitar reescritura al desmontarse. `INITIAL_SESSION` y un error transitorio de autenticación no borran recuperación al recargar. Depende de la sesión del navegador y no sustituye la remota.

`billing_draft_events` registra metadatos mínimos de guardado/descarte/confirmación sin contenido fiscal ni lectura directa del cliente. `billing_draft_commits` conserva petición/documento durante 30 días. `purge_billing_recovery()` elimina copias caducadas, eventos >90 días y confirmaciones >30 días; solo propietario SQL/service_role. Copias remotas caducan a los 30 días de última escritura aceptada y quedan inaccesibles por RLS/RPC; la eliminación física requiere programar purga. Ver `entornos.md`.

Si falta la nueva RPC se muestra aviso y continúa el guardado manual anterior, sin afirmar protección remota. Errores de red conservan entrada/copia local y ofrecen reintento; denegaciones detienen escrituras. Pruebas PostgreSQL locales cubren permisos/concurrencia, no el estado desplegado ni un trabajo de purga remoto.

## Biblioteca de paletas con nombre · P5

`BILLING_NAMED_PALETTES.sql` se aplica después de `BILLING_APPEARANCE.sql`. Nueva tabla `billing_color_palettes`: ID UUID, compañía, nombre, paleta JSON, actor creador y fecha. El nombre se recorta en servidor, admite 1–60 caracteres sin controles y es único por compañía sin distinguir mayúsculas. Los colores usan el contrato existente con `id: custom`; no incluyen logo ni datos fiscales.

Los miembros activos pueden leer la biblioteca de su compañía. Solo editor/admin o administrador de plataforma pueden guardar mediante `save_billing_color_palette(p_company,p_name,p_palette)`, con `SECURITY DEFINER`, `search_path` vacío y comprobación explícita de acceso. Se revocan escrituras directas y acceso anónimo; RLS limita las lecturas. La RPC devuelve un objeto JSON de la entrada guardada. Repetir nombre y colores es idempotente; con colores distintos devuelve `23505`, sin sobrescribir el diseño anterior. No se añade una operación de actualización o borrado en esta petición.

El workspace ya identificado por usuario/compañía/tipo contiene el estado de biblioteca. Cambiar de compañía/cuenta lo desmonta; cargas y guardados tardíos no se aplican al nuevo contexto. No hay caché global ni almacenamiento local. El servicio filtra todas las páginas por compañía y valida la compañía de cada respuesta, incluido el resultado de guardar. La biblioteca se comparte entre el editor y los ajustes de esa instancia.

Guardar una paleta no guarda un documento ni cambia el perfil predeterminado. Aplicarla clona sus cinco colores al emisor manteniendo `id: custom`, logo y datos fiscales actuales; no introduce referencias vivas en documentos históricos. La selección se reconoce por los colores. Un fallo conserva nombre y colores para reintentar; si falla la carga, la biblioteca ofrece reintento y el resto del editor permanece disponible.

La migración está validada con PGlite, incluidos lector, ajeno, editor de otra compañía, anónimo, miembro inactivo y denegación de escrituras directas. No está aplicada a Supabase ni verificada con sesiones remotas. Antes de producción, aplicar/validar la secuencia en desarrollo, verificar backup y usar el proceso CLI/CI autorizado; comprobar la misma paleta en Facturación y Presupuestos, recarga, aislamiento entre empresas y conservación de documentos previos.

## Directorio y catálogo reutilizable · P8

`BILLING_DIRECTORY_CATALOG.sql` amplía la tabla existente `client_company` con NIF/CIF, dirección fiscal, contacto, responsables, actor de actualización y archivo lógico. Las lecturas normales solo devuelven entradas activas. `save_client_company` y `archive_client_company` validan el permiso de edición en servidor y acotan cada ID a la compañía indicada; se revocan las escrituras directas del cliente.

`billing_catalog_items` guarda, por compañía, nombre, descripción, unidad, precio unitario e IVA. Un nombre activo es único sin distinguir mayúsculas. Lectores activos pueden consultar; editores/administradores guardan o archivan mediante RPC. Anónimo, miembro inactivo, lector que intenta escribir y usuario de otra compañía quedan rechazados. Archivar conserva la fila para auditoría y referencias, pero la elimina de las búsquedas normales.

Seleccionar un cliente copia nombre, identificación fiscal, dirección y contacto al borrador. Seleccionar un concepto crea una partida con descripción/unidad, precio e impuesto, que después se edita como cualquier otra línea. El documento guarda esa instantánea: editar o archivar el origen no altera facturas o presupuestos existentes. Los servicios comprueban también en cliente que cada respuesta pertenece a la compañía activa para no aplicar respuestas cruzadas.

La migración depende de los helpers de `BILLING_SECURITY_HARDENING.sql` y se aplica después de `BILLING_APPEARANCE.sql`; está validada solo en PostgreSQL local/PGlite. En destino deben comprobarse primero las columnas reales de `client_company`, el backup y la secuencia de migraciones.

## Duplicación y plantillas de capítulos · P9

Duplicar no escribe en servidor inmediatamente. Construye un documento nuevo con una copia profunda del emisor, cliente, presentación, pagos y partidas; elimina `sourceQuote`, número y estado, regenera los IDs de línea y vacía fecha y vencimiento. El editor exige indicar las fechas y guarda siempre como un nuevo borrador. El autoguardado usa la clave `new` y la confirmación idempotente de P7, por lo que repetir una confirmación no crea otro documento definitivo.

`BILLING_CHAPTER_TEMPLATES.sql` crea `billing_chapter_templates` por compañía con nombre, líneas, actores, fechas y archivo lógico. La RPC valida nombre, entre 1 y 200 partidas, IDs acotados, capítulos, descripciones, detalles e importes. Lectores activos pueden consultar; editor/admin guardan y archivan mediante RPC. Las escrituras directas, usuarios ajenos, anónimos, inactivos y lectores que intentan escribir quedan denegados.

Aplicar una plantilla regenera todos los IDs y copia sus partidas al presupuesto actual. Reordenar conserva esos IDs; guardar o archivar la plantilla después no altera documentos existentes. La conversión presupuesto → factura continúa siendo transaccional: la prueba existente confirma una sola factura y rechaza el segundo intento o una versión obsoleta.

## Vencimientos, cobros e historial · P10

`BILLING_PAYMENTS_HISTORY.sql` añade `billing_payment_entries` y `billing_document_events`. Los movimientos de cobro son append-only: un cobro guarda importe, fecha, método, referencia, actor y `request_id`; repetir la misma petición devuelve el resultado actual sin duplicar. El servidor bloquea la factura, vuelve a calcular el total desde su documento, impide sobrecobros y actualiza estado, versión y saldo en una transacción. Revertir crea otro movimiento ligado al original y exige un motivo; nunca elimina el cobro.

`get_invoice_financials` separa estado de cobro de estado documental y calcula vencida, pendiente, parcial o cobrada. La lista muestra saldo/vencimiento y suma saldos y cobros reales. Facturas y presupuestos generan eventos con versión, actor, fecha, acción, instantánea y resumen del cambio. La UI consulta páginas de 50 eventos limitadas por compañía; RLS permite lectura a miembros activos y las escrituras solo ocurren en triggers/RPC. Restaurar toma una instantánea histórica de borrador y la guarda mediante el contrato versionado existente, creando una revisión nueva. Un documento emitido no puede usar esa vía.

La revisión oficial confirma que una emitida no se corrige convirtiéndola en borrador: se expide una factura rectificativa nueva, se identifica la original, se declara la condición y causa, se expresa la rectificación y se usa una serie específica con numeración correlativa. La AEAT contempla rectificación por diferencias o por sustitución y tipologías R1–R4 según la causa. Fuentes: [AEAT · Facturas rectificativas](https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/facturacion-iva/facturas-rectificativas.html), [AEAT · Contenido de las facturas](https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/facturacion-iva/contenido-facturas.html) y [BOE · RD 1619/2012, art. 15](https://www.boe.es/eli/es/rd/2012/11/30/1619/).

La migración `BILLING_RECTIFYING_INVOICES.sql` añade el contador rectificativo por compañía y las columnas de relación/método/causa/idempotencia en `invoices`. La RPC `rectify_invoice` valida acceso activo, original emitida/pagada, método, causa, explicación y documento; bloquea la fila original, reserva el prefijo configurado (`rectificationPrefix`, por defecto `FR`) y la secuencia en la misma transacción, e inserta otra factura inmutable emitida. Un request UUID repetido devuelve la misma rectificativa; la referencia compuesta compañía/original impide asociaciones cross-tenant. `save_invoice` rechaza metadata rectificativa o signos de ajuste, que solo admite la ruta especializada.

En método `difference`, cada partida puede llevar `sign` -1/+1 mientras cantidad/precio permanecen positivos; el cálculo de cliente, PDF y `billing_document_total` multiplica base e IVA por ese signo. El saldo negativo aparece como crédito a favor del cliente; el panel no modela reembolsos. En `substitution`, las líneas no admiten signo y representan importes corregidos; el PDF muestra total corregido y diferencia frente al total original. La migración actualiza el agregado financiero para mostrar estado `credit`, saldo cero e importe favorable, sin permitir registrar un pago sobre total negativo. La referencia, método, causa y total original se guardan en copia documental y columnas de consulta; historial se genera mediante el trigger existente.

El prefijo se configura en los ajustes de facturación de cada empresa. Cambiarlo solo afecta la numeración futura; el contador es único por empresa, continúa desde su siguiente número y los documentos ya emitidos conservan el número original. Antes de aplicar en remoto hay que comprobar versiones previas y numeración existente para evitar que la primera serie `FR-000001` choque con un uso manual histórico. La reversión de cobro continúa siendo financiera y nunca anula la factura.

El Ministerio anunció el 5/10/2026 una previsión de trasladar obligaciones pendientes SIF a octubre de 2028. La nota no sustituye por sí sola la norma vigente: AEAT/BOE aún reflejaban 1/1/2027 y 1/7/2027. Por petición del propietario no se integra transmisión/QR VERI*FACTU ahora; revalidar el calendario normativo antes de usar el panel para emitir en un ámbito afectado.

## Inmutabilidad de facturas emitidas · P11

`BILLING_ISSUED_INVOICE_LOCK.sql` redefine solo `save_invoice` y se aplica después de `BILLING_PAYMENTS_HISTORY.sql`. Nuevas facturas solo se crean como borrador o emitidas; borradores pueden editarse y cancelarse; una factura con estado `issued` o `paid` no puede cambiar contenido ni estado mediante esta RPC. Marcar una factura como pagada solo ocurre en `register_invoice_payment`, que valida el total y los movimientos, y una reversión de cobro conserva su evento append-only. El formulario es de solo lectura para emitidas/pagadas y no ofrece su cancelación simple.

El circuito rectificativo se implementa en P12 con una nueva migración que todavía solo está comprobada localmente y queda pendiente en Supabase.

Antes de desplegar hay que inventariar facturas existentes con estado `paid`. El flujo anterior permitía fijar ese estado desde el selector, sin crear un cobro. La migración no fabrica movimientos ni puede inferir fecha/método; conciliar esos casos con los registros contables y acordar cómo presentarlos en historial es una puerta de despliegue. También verificar emitidas y canceladas históricas antes de habilitar la vista solo lectura.
