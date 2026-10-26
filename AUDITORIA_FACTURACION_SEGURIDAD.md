**Revisión de facturación, presupuestos y aislamiento entre empresas — 22/10/2026**

La revisión ha encontrado fallos reales y ha incorporado correcciones en el código y nuevas migraciones. Los dos SQL iniciales siguen siendo necesarios, pero no incluyen estas correcciones posteriores. Las protecciones de servidor descritas aquí solo estarán activas después de aplicar las tres migraciones indicadas al final y desplegar el frontend actualizado.

**Alcance y evidencia**

Se revisaron las RPC de facturas, presupuestos y datos del emisor; las políticas RLS; los permisos de tablas y funciones; la numeración; las referencias de clientes y facturas; los adjuntos del planning; el cambio de empresa y de usuario; la generación de documentos; y las dependencias utilizadas en producción.

Se ejecutan las migraciones reales del repositorio en un PostgreSQL local mediante PGlite. Los helpers de permisos se extraen de DB_SCHEMA.sql. Se crean empresas y usuarios ficticios, con roles SQL autenticado y anónimo, y se prueban peticiones que omiten las restricciones del formulario. No se emplean datos reales en estas pruebas.

Resultado: 238 pruebas superadas, de las cuales 57 ejercitan PostgreSQL y 7 los formularios y cambios de empresa en un DOM de pruebas. Las pruebas SQL incluyen seis reproducciones de comportamientos inseguros o insuficientes de las migraciones iniciales; las demás comprueban las protecciones posteriores. También pasan las pruebas de importes, PDF, servicios, navegación y funcionalidades anteriores.

**Hallazgos y correcciones**

| Prioridad | Hallazgo | Corrección y comprobación |
|---|---|---|
| Alta | La impresión HTML antigua del planning insertaba sin escapar el nombre del cliente, concepto, descripción e importe. Un contenido malicioso podía interpretarse como HTML al imprimir. | Se escapan todas las interpolaciones procedentes de datos y traducciones. Una prueba introduce etiquetas con scripts y eventos y verifica que aparecen como texto. |
| Alta | Las rutas antiguas de adjuntos no identifican a la empresa. No había una configuración de políticas de ese bucket versionada que permitiera garantizar su aislamiento. | Las nuevas rutas incluyen el ID de empresa. El bucket se hace privado y se añaden políticas restrictivas de lectura, subida, modificación y borrado. Se prueba que una política antigua permisiva no anula estas restricciones. Esto es una protección nueva; no es evidencia de una filtración previa. |
| Alta | Autorizar adjuntos antiguos por referencias JSON editables permitiría que un editor copiara una ruta de otro tenant a su tarea y reclamara acceso. | La migración fija una sola vez la pertenencia de los archivos antiguos en una tabla interna sin permisos para usuarios. Referencias añadidas después no otorgan acceso. Los archivos con referencias iniciales ambiguas entre empresas quedan bloqueados hasta revisión manual. Se prueba la falsificación y la reaplicación de la migración. |
| Media | Planning permitía asociar una tarea o previsión de una empresa a un cliente de otra: la clave ajena comprobaba únicamente el ID del cliente. | Se añaden claves ajenas compuestas por empresa e ID. Se impide cambiar la empresa de registros existentes, incluso para usuarios miembros de ambas. Se reproduce el problema original y se verifica el rechazo posterior. |
| Media | La API aceptaba nombres con estructura JSON, importes como "NaN" y fechas relativas como "today". El formulario no basta como validación de seguridad. | Validación de tipos, fechas absolutas, límites, precisión, cantidades, impuestos, retenciones y número de líneas en servidor y cliente. Se rechazan logos remotos/SVG y colores o series inválidos. Las cargas históricas malformadas fallan de forma controlada. |
| Media | Dos editores podían sobrescribir los datos fiscales y las series de numeración sin advertencia. | Los datos del emisor tienen versión y las escrituras rechazan versiones obsoletas. Los contadores no se pueden modificar por REST. Se comprueba también el primer guardado cuando la numeración ya había creado una configuración vacía. |
| Media | El planning conservaba formularios y estado al cambiar de empresa; respuestas antiguas podían llegar después de un cambio de contexto. | Las páginas se remontan por usuario y empresa, se descartan respuestas de carga obsoletas y se limpia el contexto al cambiar de cuenta. Se comprueba que el editor anterior desaparece y una confirmación pendiente no convierte un documento después del cambio de empresa. |
| Media | Tras editar un documento, descargar o convertir podía utilizar la copia persistida anterior a los cambios visibles. | Se bloquean esas acciones mientras hay cambios sin guardar y se muestra una explicación. |
| Media | Los cálculos binarios de JavaScript podían diferir del redondeo decimal de PostgreSQL. | Cálculo en céntimos con enteros y redondeo explícito. Se comparan casos de milésimas, descuentos y tipos de IVA con operaciones numeric de PostgreSQL. |
| Media | Los enlaces antiguos de adjuntos admitían destinos arbitrarios. | Solo se recuperan rutas del proyecto Supabase configurado y se solicitan URLs firmadas, con cinco minutos de validez. Se rechazan javascript:, data: y proyectos externos. |

**Aislamiento comprobado**

Las pruebas locales verifican estos comportamientos:

- Un editor solo puede consultar y modificar documentos de su empresa; un viewer puede leer pero no escribir.
- Un usuario autenticado ajeno no obtiene filas. El rol anónimo no puede leer las tablas ni ejecutar las RPC tras la migración de seguridad.
- Conocer el ID de un documento ajeno no permite modificarlo ni convertirlo usando otro tenant. Se prueba también con un usuario editor en las dos empresas.
- El administrador de plataforma conserva el acceso global previsto por el modelo del proyecto. Este acceso es intencionado.
- Ni siquiera un editor autorizado puede escribir directamente en las tablas de facturas, presupuestos o configuración: debe pasar por las RPC.
- Cada empresa mantiene sus contadores. Facturas y presupuestos tienen series independientes y las operaciones inválidas no consumen números.
- Las versiones antiguas se rechazan. Los documentos cancelados no se reabren, y un presupuesto facturado no se modifica ni se convierte de nuevo.
- La conversión solo admite presupuestos aceptados, conserva las copias del emisor y cliente y crea una factura en borrador. La referencia a esa factura debe pertenecer al mismo tenant.
- Los adjuntos de otra empresa no se pueden leer, subir, mover ni borrar; los viewers solo tienen lectura. Se prueban rutas nuevas y antiguas.

La conversión se revisó como transacción con bloqueo de fila y se probaron reintentos y versiones obsoletas. No se realizó una prueba de carga con múltiples conexiones remotas simultáneas.

**Comprobaciones en Supabase real**

Se usó únicamente la clave pública anónima configurada en el proyecto, sin imprimir credenciales y sin escribir datos. Las consultas a invoices, quotes e invoice_settings respondieron con cero filas. La ruta pública de prueba del bucket respondió "Bucket not found".

Estos resultados no demuestran por sí solos el aislamiento remoto: las tablas podrían estar vacías y Storage no distingue públicamente todos los motivos de denegación. No se dispuso de sesiones autenticadas de dos empresas ni de una conexión administrativa que permitiera comparar las políticas desplegadas con el repositorio. La matriz de roles se ha verificado en PostgreSQL local; la comprobación autenticada del entorno real sigue pendiente.

**Dependencias y comprobaciones generales**

Se actualizaron React Router y ws dentro de las versiones compatibles. La auditoría npm de producción pasó de cuatro paquetes señalados a uno: xlsx 0.18.5, utilizado en la importación de Excel. Sigue teniendo avisos de seguridad y no dispone de una corrección publicada en el registro npm para esa dependencia. Sustituirla o migrar la importación sigue pendiente; no se puede declarar la aplicación libre de vulnerabilidades conocidas.

La compilación de producción y el lint de los archivos revisados pasan. El lint global del repositorio sigue mostrando 11 errores y 6 avisos en otros archivos. La compilación mantiene un aviso de tamaño de un chunk superior a 500 kB. No se han tratado esos problemas ajenos al cambio como si estuvieran resueltos.

Los estados enviado, aceptado, emitida y pagada son manuales: no acreditan envío de email, firma del cliente o conciliación bancaria. Las previsiones del planning y las facturas son datos separados; no hay sincronización automática entre ambos módulos.

Las pruebas de interfaz verifican comportamiento con Happy DOM, no el aspecto visual en un navegador ni los tamaños reales de PC/tablet. La revisión tampoco equivale a una auditoría completa de todas las Edge Functions y módulos de la plataforma.

**Aplicación en el entorno real**

1. Ejecutar database/migrations/BILLING_SECURITY_HARDENING.sql después de los dos SQL iniciales.
2. Revisar las consultas 3 y 4 de database/maintenance/BILLING_SECURITY_AUDIT.sql. No deben existir referencias cruzadas entre empresas. Si hay registros incompatibles, revisarlos antes de continuar; no corregirlos asignando empresas a ciegas.
3. Ejecutar database/migrations/PLANNING_TENANT_HARDENING.sql. Las referencias existentes incompatibles detienen la transacción sin modificar datos.
4. Ejecutar database/migrations/PLANNING_STORAGE_HARDENING.sql. Crea la asignación inicial protegida de adjuntos antiguos; si un archivo estaba referenciado por varias empresas, queda bloqueado para revisión.
5. Desplegar el frontend actualizado junto con las migraciones. El nuevo guardado de emisor usa la versión de configuración y las nuevas subidas incluyen el tenant en su ruta.
6. Ejecutar completo database/maintenance/BILLING_SECURITY_AUDIT.sql como consulta administrativa y comprobar con usuarios reales de dos empresas: lectura, modificación, descarga, conversión y adjuntos.

No se aplicaron estas nuevas migraciones remotamente ni se modificaron facturas o presupuestos reales durante la revisión. El archivo de auditoría contiene únicamente consultas y validaciones de lectura.

**Revisión aditiva local — 26/10/2026 [P19]**

Se contrastaron las migraciones de paletas, borradores, directorio/catálogo, plantillas, cobros/historial, rectificativas, cola de emails y movimientos de Planning con sus pruebas PGlite. La matriz local incluye roles `viewer`, `editor`, usuarios externos y duales cuando corresponde; hay pruebas de escrituras directas, IDs de otra empresa, membresía inactiva, borradores privados entre autores, reintentos idempotentes y versiones obsoletas. Los tests ejercitan esas RPC bajo `authenticated`, `anon` y `service_role` según su contrato.

No se encontró una brecha nueva durante esta lectura. Esto confirma únicamente cobertura del esquema del repositorio bajo PGlite; no demuestra que las migraciones estén aplicadas, que las políticas desplegadas coincidan, ni que no existan carreras bajo concurrencia real. Siguen pendientes prueba con latencia/conflictos en entorno integrado, usuarios autenticados de dos empresas en el destino y verificación de backups/restauración. La suite local actual pasa **416 pruebas en 66 archivos**.
