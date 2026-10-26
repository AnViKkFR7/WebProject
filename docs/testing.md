# Verificación de la evolución de documentos

## Aprobación de presupuestos · compilación Edge local · 26/10/2026

- `npm run check:functions`: **13/13 Edge Functions compilan**, incluidas `send-quote-approval-link` y `notify-quote-approval-response` con el renderer de emails compartido.
- El usuario ejecutó el preflight actualizado `database/maintenance/BILLING_QUOTE_APPROVAL_PREFLIGHT.sql` en Supabase y confirma que todos sus indicadores devolvieron `true`. Esto confirma el esquema/permisos comprobados por ese preflight; no confirma despliegue. Sigue pendiente desplegar ambas funciones y hacer un envío/respuesta controlados en Vercel/Resend.
- No se hizo ningún envío real ni hubo despliegues. El preflight remoto fue ejecutado por el usuario; este cambio local no ejecutó SQL.

## Emails al cliente · idioma de envío · 26/10/2026

- Se añade una selección común por empresa para usar el HTML ES o EN en aprobaciones de presupuesto y avisos automáticos de vencimiento. Las configuraciones antiguas y valores inválidos usan español. No requiere SQL: la propiedad opcional se guarda dentro del JSON de configuración aceptado por las RPC y el emisor solo admite EN explícitamente; cualquier otro valor cae a ES.
- Pruebas del renderer/resolvedor y del selector del panel; una prueba PGlite confirma que `emailLanguage:'en'` se guarda y recupera desde las RPC existentes. Suite completa: **538 pruebas en 95 archivos**. `npm run check:functions` confirma la compilación de ambos emisores Edge (13/13 funciones en total); lint y build también pasan.
- Pendiente despliegue conjunto para comprobar la entrega real por idioma; no se envió correo ni se desplegó.

## Accesibilidad · foco visible en campos · 26/10/2026

- Se detectaron reglas de `.input`, `.select`, formularios, búsqueda y atributos que anulaban `outline` durante el foco. Se añade un contorno explícito al estado `:focus-visible` y una regresión en `tests/accessibility/focusIndicators.test.js`.
- El editor de descripción de Items tenía una regla `.description-edit .input:focus` más específica, que el selector global no alcanzaba. El estado `:focus-visible` tiene ahora contorno propio; la prueba accesible cubre ese caso además de los campos globales.
- El color del contorno global de foco usa el token primario. La prueba de tokens comprueba explícitamente su contraste mínimo 3:1 con las superficies de panel de los temas claro y oscuro.
- `npm test -- --run`: **539 pruebas en 95 archivos**; lint y build correctos. El build mantiene el aviso de chunk principal de 683,38 KB.
- La revisión es estática; Computer Use en Windows se detuvo porque no pudo determinar con suficiente confianza la URL activa. La captura visual autenticada sigue pendiente. No requiere SQL.

## Accesibilidad · nombres y tooltips de botones de icono · 26/10/2026

- La auditoría estática identificó botones solo-icono de limpieza de búsquedas, edición de usuario y visibilidad de contraseña. Se añadieron `aria-label` y `title` con traducciones ES/EN y etiquetas de acción dinámicas. El gestor global también obtiene nombre y tooltip de las etiquetas HTML asociadas a interruptores.
- `ButtonTooltipManager.test.jsx`: 1 prueba correcta. Suite completa: **535 pruebas en 95 archivos**. `npm run lint` y `npm run build` correctos; Vite conserva el aviso del chunk principal de 682,84 KB.
- No hubo SQL, commits ni despliegues. La auditoría visual autenticada y la revisión de contraste por pantalla/viewport siguen pendientes.

## Fase 4 · aprobación de presupuestos por enlace · 26/10/2026

- `BILLING_QUOTE_APPROVAL.sql` aplicada dos veces en PGlite. 4 pruebas PostgreSQL validan emisión solo sobre presupuesto enviado, denegación de viewer y empresa ajena, aceptación/rechazo de un solo uso, retry idempotente, reemisión, expiración y revocación cuando cambia o se cierra el documento.
- 3 pruebas de servicio cubren token aleatorio, hash SHA-256 y que el enlace usa un fragmento URL para que el bearer no viaje en la petición HTTP al hosting. La respuesta pública requiere nombre/email declarados, confirmación y guarda motivo opcional del rechazo. Página `/quotes/respond` no requiere login; el panel copia el enlace y consulta la traza.
- Suite completa: **452 pruebas correctas en 74 archivos**; lint global correcto. Build correcto: el chunk principal queda en **664,15 KB** (aviso >500 KB), Analytics **412,63 KB**, XLSX **429,19 KB**, PDF **403,93 KB**. El editor de facturas está dividido en un chunk de **81,20 KB**.
- No se envía email. La identidad capturada es declarada, no verificada. No hay auditoría visual en navegador real ni prueba con Supabase remoto. La migración sigue local; `database/README.md` documenta que debe ejecutarse antes de `COMPANY_MODULES.sql`.

## Fase 3 · enlaces CRM con facturación · 26/10/2026

- `CRM_BILLING_LINKS.sql` aplicada dos veces en PGlite; 9 pruebas del flujo CRM cubren los vínculos explícitos, acceso editor/admin, denegación viewer, rechazo de documentos de otra empresa, exportación con documento y anonimización que retira vínculos sin alterar la factura.
- La ficha de contacto tiene una sección de facturas/presupuestos con selector de documentos libres y acción para retirar una asociación. Se respetan los módulos CRM y billing cuando está instalada `COMPANY_MODULES.sql`. Exportación de privacidad incluye solo documentos vinculados; la pantalla muestra ese alcance y el número de asociaciones a retirar.
- Suite completa: **445 pruebas correctas en 72 archivos**. ESLint global y build correctos. Build actual: bundle principal **660,12 KB**, Analytics **412,63 KB**, XLSX **429,19 KB** e Invoicing **482,16 KB**; persiste el aviso de chunks >500 KB.
- `git diff --check` correcto; Git solo avisa de normalización LF/CRLF. No se aplicó SQL en Supabase ni se desplegó el panel. No se hizo revisión visual autenticada de la ficha CRM en navegador.

## Fase 5 · módulos por empresa y búsqueda global · 26/10/2026

- PGlite aplica dos veces `COMPANY_MODULES.sql`; 5 pruebas verifican los seis módulos activos en empresas existentes/nuevas, escritura reservada al rol admin, ocultación por RLS, bloqueo de escrituras directas/RPC y cancelación de avisos pendientes.
- La navegación valida módulos desactivados y que solo el admin vea sus ajustes. La búsqueda se valida con empresa/módulos activos, rutas estables y términos insuficientes. `npm test`: **440 pruebas correctas en 71 archivos**, incluidos los casos del emisor Edge cuando Planning está apagado.
- ESLint dirigido y `npm run lint` global correctos. `npm run build` correcta; mantiene avisos de chunks >500 KB: principal **654,79 KB**, Analytics **412,63 KB**, XLSX **429,19 KB** e Invoicing **482,16 KB**.
- `git diff --check` sin errores de whitespace; solo avisos de conversión LF/CRLF de Windows.
- Migración local únicamente: no se comprobó ni modificó Supabase remoto. La lista de dependencias y el orden están en `database/README.md`; aplicar como última migración, después de la cola de Planning y todas las tablas opcionales de billing. La búsqueda no añade tablas; depende de que la migración de módulos ya esté aplicada. La revisión visual autenticada y el ensayo real de Supabase/Resend quedan pendientes.

## Entrega P16 parcial · 26/10/2026 · Preparación responsive de galería

- Revisión estática de `/__dev/gallery`: ruta condicionada por `import.meta.env.DEV`, fixture explícito de Planning y sin llamada de envío/guardado desde el componente.
- CSS: dos columnas a partir de 861 px, una columna por debajo; el email ocupa la retícula completa. Inputs usan `border-box`, iframe limita su anchura y texto largo puede partirse.
- La inspección de Computer Use se detuvo porque no pudo determinar con confianza la URL actual del navegador. No se interactuó con ventanas ni se obtuvieron capturas. Por tanto, tablet/móvil/escritorio, interacción y capturas quedan sin verificar, y la casilla de galería de fase 8B permanece pendiente.
- `npm test -- --run`: **415 pruebas en 65 archivos**; `npm run lint`: correcto; `npm run build`: correcto. Sigue el aviso de chunk principal de **633,23 KB** (Invoicing: **482,16 KB**). `npm run check:production-output` confirmó ausencia de source maps, `design-preview` y el marcador de la galería; `git diff --check` correcto con avisos LF/CRLF.

## Entrega P17 parcial · 26/10/2026 · Contrato de métricas y retención

- Solo documentación: métricas futuras limitadas a contadores por categorías cerradas, entorno y versión; sin IDs, PII ni contenido fiscal. No existe colector ni se activa egress hasta acordar proveedor, retención, acceso y payload.
- Se distinguen caducidades técnicas (borradores y cola) de la conservación de documentos, movimientos de cobro e historial append-only. Sin periodo de purga fiscal definido, no se crea una purga destructiva. Configuración real de retención de Vercel, Supabase y backups sigue pendiente de inventario.

## Entrega P18 · 26/10/2026 · Scroll lateral del menú contraído

- Se fija el ancho del sidebar con `box-sizing: border-box` y se bloquea el overflow horizontal en el contenedor/nav contraídos, manteniendo el scroll vertical del nav.
- `src/layouts/sidebarStyles.test.js` conserva una regresión de estos estilos. No se hizo revisión visual de navegador en esta entrega.

## Entrega P19 parcial · 26/10/2026 · Revisión multiempresa local

- Lectura cruzada de las migraciones de facturación/Planning y los tests PGlite existentes: se cubren viewer/editor, usuarios externos/duales, membresía inactiva, escrituras directas, IDs de otra compañía, borradores entre autores, idempotencia y conflictos por versión.
- La suite completa pasó **416 pruebas en 66 archivos**. No hubo sesión remota, conexiones concurrentes reales, prueba de latencia ni comprobación de backup/restauración; la casilla de auditoría de fase 8B sigue abierta.

## Entrega P15 · 26/10/2026 · Diagnóstico con datos mínimos

- `reportOperationalFailure` registra solo códigos cerrados de facturación/usuarios, entorno, versión, tipo de excepción permitido y hora. Dos pruebas verifican ausencia de email, número de factura, secreto, texto libre, scopes/códigos/env/version arbitrarios.
- Facturación instrumenta fallo de guardado/cancelación/conversión, perfil y generación de PDF. El servicio de usuarios deja de imprimir errores, contexto HTTP y body completo; conserva el mensaje funcional para el formulario y registra solo código seguro.
- Planning Edge registra errores como códigos cerrados con `DEPLOYMENT_ENV` y `APP_VERSION` sanitizados. La prueba mock confirma que ni el correo ni el body del proveedor llegan al log.
- El workflow asigna `ci` y SHA de GitHub. Vercel aporta `VERCEL_ENV` y `VERCEL_GIT_COMMIT_SHA`; local usa `local`/`local`. Las variables `VITE_DEPLOYMENT_ENV` y `VITE_APP_VERSION` permiten sobrescribirlo.
- Verificación final: `npm test` **415 pruebas en 65 archivos**, `npm run lint` correcto, build correcta (chunk principal **633,23 KB**, aviso >500 KB), `check:functions` 9/9, `check:production-output` y `git diff --check` correctos.

La consola del navegador no es monitorización centralizada. No hay proveedor de errores/telemetría seleccionado ni se envían estos eventos fuera de la aplicación. Antes de conectar un colector faltan aprobación del proveedor, política de retención/acceso y prueba de su payload. Supabase remoto y sus logs no se han comprobado.

## Entrega P14 parcial · 26/10/2026 · cola operativa y CI base

- `tests/database/planningEmailQueue.test.js`: **5 pruebas PGlite correctas** de enqueue idempotente, claim, marca de envío, backoff, privacidad, permisos de reintento, purga, entrega incierta y protección antes de caducar la idempotencia.
- `tests/planningReminderDelivery.test.js`: mock del Edge verifica enqueue/claim, render HTML/texto, revalidación de permisos, idempotency key, finalización, código de error cerrado y no filtración del payload del proveedor.
- `PlanningEmailFailures` y servicio: viewer consulta sin reintento; editor reencola; validación de tenant/IDs y errores de RPC.
- Suite completa: **413 pruebas correctas en 64 archivos**. `npm run lint` global pasa sin errores ni avisos; se retiraron hooks/estados obsoletos y se estabilizaron dependencias de efectos.
- `npm run build`: correcto; principal **633,15 KB**, Invoicing **481,76 KB**. Se conserva el aviso del chunk principal superior a 500 KB.
- `npm run check:production-output`: correcto; la salida no contiene source maps ni los artefactos `design-preview`.
- `npm run check:functions`: **9/9 Edge Functions** compilan y pasan el verificador.
- Ruta dev `/__dev/gallery` añadida con controles compartidos y template de recordatorio construido desde fixture. El marcador de módulo se busca en todos los JS de producción; build/comprobador abajo.
- `git diff --check`: correcto; solo avisos de normalización LF/CRLF.
- Workflow GitHub para lint, suite panel, build, revisión de artefactos de producción y funciones. La ejecución remota sigue sin verificar hasta que GitHub ejecute el workflow.
- La integración con Resend se probó con fetch mock, no se hizo un envío real. El usuario autorizó expresamente transmitir la información necesaria del recordatorio a ese proveedor. No se guardaron secretos ni se envió correo durante la implementación.
- Siguen pendientes capturas/revisión visual en navegador, SPF/DKIM/DMARC, E2E autenticado, axe/Lighthouse, workflow remoto, verificación Supabase, backup/restore, purga programada y seguimiento en destino.

## Entrega P2 · 22/10/2026

Comprobaciones locales, con servicios simulados en las pruebas de UI. No certifican migraciones, políticas o despliegues del Supabase de producción.

- Suite completa de Vitest, incluidos tests existentes de BD/RLS: **296 tests correctos en 39 archivos**.
- Build de producción correcto. Sigue el aviso de tamaño del chunk principal (~607 KB); el chunk de Invoicing queda por debajo de 500 KB (~428 KB). No se ha ocultado ni elevado el umbral del aviso.
- ESLint sobre los archivos de implementación/pruebas modificados: correcto.
- Pruebas de navegación con `createMemoryRouter`, sin sustituir la API de bloqueo: enlaces directos, ID inexistente/ajeno no cargado, lector sin creación, filtros/scroll al volver, atrás, cambios de sección, confirmación aceptada/rechazada, aviso de recarga, fallo/reintento de guardado y cambio de compañía.
- Regresiones de emisor guardado/personalizado, capítulos con varias partidas, descarga del documento editado como borrador y confirmación de conversión pendiente tras cambio de tenant.
- Preview: pausa de escritura, descarte de temporizadores antiguos, enlaces vigentes durante sustitución, liberación de URLs y recuperación de un fallo al reintentar.

## Revisión en navegador

Fixture temporal con componentes/estilos reales, datos ficticios y servicio de memoria; eliminado tras revisar. No se enviaron emails ni se escribieron documentos remotos.

- Tamaños revisados: 375×812, 768×1024, 1024×768, 1280×900 y 1536×1000. Sin desbordamiento horizontal; preview simultáneo cuando el contenido alcanza 1100 px de ancho, alternancia por debajo.
- ES/EN y claro/oscuro. El papel del PDF conserva su fondo blanco. Cabeceras/controles legibles, campos contenidos, acción de volver con etiqueta accesible en móvil.
- Guardar factura/presupuesto con datos válidos vuelve al listado; validación nativa de cantidades decimales comprobada en navegador.
- Salir de un documento modificado muestra confirmación; Cancelar conserva entrada. Preview refleja cambios del cliente. Guardar desde preview con campos pendientes vuelve a Editar y enfoca el nombre requerido.
- Se revisan semántica de campos y un único H1 en el editor. No se añaden animaciones nuevas.

Capturas de revisión guardadas en el directorio de visualizaciones de esta conversación: `editor-factura-escritorio.png`, `editor-documento-tablet.png` y `editor-documento-movil.png`. Son capturas de datos ficticios, no de producción.

## Comandos

Desde `admin-panel`: `npm test`, `npm run build` y `npx eslint` con los archivos modificados. Las funciones Edge no se han modificado en P2; su despliegue previo pendiente se comprueba por separado.

Happy DOM tiene un problema de módulo en coma flotante con pasos fraccionarios: en el test específico de fallo/reintento remoto se usa `step=any` sobre los controles del test, manteniendo la validación de negocio real. Las restricciones nativas de los controles originales se verificaron sin esa adaptación en el navegador.

## Puertas de lanzamiento todavía pendientes

- Axe y Lighthouse automatizados sobre la build de producción; no se han presentado métricas no medidas.
- E2E autenticado contra entorno de desarrollo, comprobación de hosting/rewrite y accesos directos tras despliegue.
- Estado real de migraciones/Edge Functions de entregas anteriores, smoke test y backups de producción.
- Automatizar capturas/CI y resolver el presupuesto del chunk principal según fase 8; conservar las regresiones de esta entrega.

## Entrega P3 · 24/10/2026 · Identidad y PDF

Al comenzar ya existían `DocumentAppearance`, las paletas, la copia de identidad, sus pruebas y `BILLING_APPEARANCE.sql`, pero no figuraban completados en el roadmap. Se han revisado y completado sus regresiones y documentación. No se ha aplicado una migración ni desplegado el panel/funciones.

### Verificación automatizada

- Línea base antes de cambios: **319 tests en 42 archivos correctos** y build correcta.
- Suite completa tras cambios: **324 tests en 42 archivos correctos** (`npm test`). Incluye las pruebas PGlite de paletas/contraste, snapshots, conversión y denegaciones de lector, usuario ajeno, editor de otra compañía y membresía inactiva.
- Nuevas regresiones: el logo anterior se conserva si falla el reemplazo, permite reintentar y quitarlo en factura/presupuesto; un logo antiguo corrupto usa el fallback sin imagen; los textos del presupuesto sobre superficies con acento de poco contraste alcanzan al menos 4,5:1 y conservan el acento guardado sobre papel.
- Pruebas existentes conservadas: rechazo de tipos, firmas, tamaño y dimensiones; decodificación; tres paletas y personalizada; códigos inválidos/contraste; identidad independiente del emisor; default explícito y copia histórica; proporción de logo y roles de paleta compartidos por preview/PDF.
- `npm run build`: correcta. Sigue el aviso previo del chunk principal (**610,20 KB**; antes **610,10 KB**). Invoicing: **435,43 KB**, por debajo de 500 KB. No se ha cambiado el umbral.
- ESLint de todos los archivos JS/JSX afectados: correcto.
- `npm run lint` global, ejecutado antes de editar: **10 errores y 5 avisos previos**. Errores en `.design-preview/main.jsx`, `AuthGuard.jsx`, `CreateUserTab.jsx`, `SecurityTab.jsx`, `FeedbackContext.jsx`, `LanguageContext.jsx`, `ItemDetail.jsx`, `ResetPassword.jsx` y `userService.js`; avisos en `ItemMedia.jsx`, `PersonalTab.jsx`, `ItemDetail.jsx` y `ResetPassword.jsx`. No se modifican archivos ajenos para ocultarlos.
- No se han modificado funciones Edge: `check:functions` no es pertinente a esta entrega.

### Revisión real en navegador

Se reutilizó la fixture existente `.design-preview`, con componentes reales y servicios de memoria, mediante un HTML temporal eliminado al acabar. No se escribieron documentos remotos, no se enviaron correos y no se conectó la fixture a Supabase.

- Revisados 375×812, 768×1024, 1024×768, 1280×900 y 1536×1000: sin desbordamiento horizontal. Paletas en dos columnas, acciones accesibles y preview simultáneo cuando hay espacio.
- Presupuesto: selección de paletas, selección personalizada, cinco HEX, rechazo de texto blanco ilegible y recuperación al corregirlo; navegación de foco por teclado y selección anunciada con `aria-pressed`.
- PNG real de prueba 640×180: decodifica y conserva su proporción en miniaturas y preview. Papel y miniatura permanecen claros con tema oscuro. Verificados ES/EN y claro/oscuro.
- Factura: editor y selección de identidad revisados con la misma fixture; preview/PDF cubiertos también por tests de ambos tipos.
- Capturas con datos ficticios en el directorio de visualizaciones de este chat: `identidad-movil.jpg` e `identidad-escritorio.jpg`.

### Límites y despliegue

El estado de `BILLING_APPEARANCE.sql` en Supabase no se ha comprobado. La validación SQL verifica estructura, límites y firmas de imagen; la decodificación completa y las dimensiones se comprueban en el navegador. No se presenta la firma binaria como decodificación completa de servidor.

Las comprobaciones remotas de roles, backup/recuperación, E2E autenticado, axe/Lighthouse y CI de la fase 8 siguen pendientes. P3 no añade animaciones; no se ha ejecutado una auditoría nueva del movimiento de toda la aplicación. Las casillas de fase 2 indican implementación y validación local, no lanzamiento certificado.

## Entrega P4 · 24/10/2026 · Colores guiados

- `npm test`: **327 tests correctos en 42 archivos**. Se mantienen las pruebas de BD/RLS y los contratos de contraste del servidor.
- Nuevas pruebas puras: muestras distintas por rol; al menos cinco opciones válidas por bloque desde cada preset; cada muestra habilitada conserva una paleta válida. Recalcular compatibilidad al cambiar el acento, identificar relaciones concretas y permitir corregir otros bloques si hay un HEX incompleto.
- Nueva regresión de UI: no permite seleccionar blanco como texto sobre fondos claros; cambiar el acento bloquea/desbloquea un pastel del papel; seleccionar muestras válidas no muestra errores; el HEX inválido por contraste marca el campo correspondiente, describe los fondos incompatibles y se recupera al elegir una muestra. No escribe perfiles ni documentos de forma implícita.
- ESLint de los archivos afectados: correcto. Continúan documentados los fallos globales previos; no se ha cambiado su configuración.
- `npm run build`: correcta; se conserva el aviso previo de tamaño. Chunk principal **611,70 KB**, Invoicing **436,81 KB**.
- Revisión real con la fixture de memoria: **375×812, 768×1024, 1024×768 y 1280×900**, sin scroll horizontal. Los cinco bloques reorganizan sus columnas según el ancho. Se seleccionaron fondos cálidos y se comprobó el bloqueo dinámico, foco por teclado, mensajes por campo y recuperación. ES/EN y claro/oscuro revisados, incluido el aviso de HEX con texto blanco inválido en inglés.
- Capturas de datos ficticios en las visualizaciones de este chat: `colores-guiados-escritorio.jpg` y `colores-guiados-movil.jpg`. HTML temporal y servidor retirados tras revisar.

Esta entrega no cambia el contrato SQL, permisos ni datos guardados. Las muestras previenen combinaciones inválidas partiendo de una válida; el HEX manual puede seguir siendo inválido y conserva su entrada para corregirla. No se añaden animaciones, dependencias, commits ni despliegues. Las puertas de lanzamiento de P3 siguen pendientes.

## Entrega P5 · 24/10/2026 · Paletas con nombre

- Suite completa final: **342 tests correctos en 44 archivos** (`npm test`), sin llamadas de servicios reales en las pruebas de UI. Los tests que importan Invoicing sustituyen también la nueva biblioteca por un servicio simulado.
- `tests/database/billingNamedPalettes.test.js`: aplica la nueva migración sobre PGlite con sus dependencias. Verifica persistencia de nombre/colores/actor, recorte y unicidad sin distinguir mayúsculas, reintentos idempotentes, rechazo de colores/nombres inválidos, acceso de lectura por empresa y denegación de escrituras para lector/ajeno/editor de otra compañía/anónimo/inactivo. Comprueba que no hay escritura directa y que facturas/presupuestos mantienen sus copias.
- `billingPaletteService.test.js`: filtrado de compañía en todas las páginas (501 registros), rechazo de respuestas cruzadas de carga/guardado, validación del nombre, propagación de errores y parámetros RPC. La RPC nueva devuelve explícitamente un objeto JSON; los seis tests SQL se repitieron tras fijar ese contrato.
- Regresiones de UI para factura/presupuesto: guardar por nombre con Enter sin enviar el documento, preservar entrada ante fallo y reintentar, aplicar colores guardados sin guardar perfil/documento; ignorar carga/guardado tardíos de otra compañía. Lector con biblioteca visible sin guardado. Error de carga no bloquea la edición y permite reintentar.
- ESLint de todos los archivos JS/JSX afectados: correcto. Se mantienen los fallos globales anteriores documentados en P3.
- Build final correcta: Invoicing **441,04 KB**, chunk principal **613,12 KB** con el aviso previo de >500 KB. No se cambia el umbral.
- Navegador con servicios de memoria y componentes reales: guardar «Arena y mar» y «Lavanda», rechazar nombre repetido con otros colores conservando el nombre, aplicar la primera paleta y comprobar selección. Revisados **375×812, 768×1024, 1024×768 y 1280×900**, sin desbordamiento horizontal; ES/EN y claro/oscuro. Capturas `paletas-con-nombre-escritorio.jpg` y `paletas-con-nombre-movil.jpg` en las visualizaciones de este chat.

Se retiraron HTML/config/mock temporales y servidor de revisión. No se han aplicado migraciones en Supabase ni desplegado código. La nueva biblioteca requiere **BILLING_APPEARANCE → BILLING_NAMED_PALETTES** en destino. Revisión remota autenticada, backup/recuperación y puertas de lanzamiento siguen pendientes. No se han modificado funciones Edge; no corresponde ejecutar `check:functions` en esta entrega. No se añaden animaciones ni dependencias.

## Entrega P7 · 24/10/2026 · Autoguardado y recuperación

- Suite final: **367 tests correctos en 47 archivos** (`npm test`). ESLint de todos los JS/JSX afectados correcto. Build correcta: principal **619,13 KB**, Invoicing **452,23 KB**; se mantiene aviso previo >500 KB y no se cambia umbral. Los fallos de lint global previos siguen documentados en P3; no se han corregido módulos ajenos.
- PostgreSQL local/PGlite: `billingDrafts.test.js` aplica migración y dependencias. Borradores incompletos sin numeración, token idempotente/auditoría, CAS, validación acotada, privacidad entre usuarios de una empresa, aislamiento entre empresas, denegación lector/ajeno/anónimo/inactivo/escrituras directas, caducidad y acceso restringido a purga. Confirmación explícita valida y consume numeración atómicamente, reintento no duplica y consulta reconoce respuesta perdida. Versión original cambiada o documento emitido impiden autoguardado.
- Controlador: pausa de 1 s, serialización, respuestas antiguas sin sustituir entrada, token estable en reintento, detener conflicto, conservar copias al desmontar, recuperación/preparación/limpieza, carga tardía ignorada, TTL/ámbitos y namespace de logout, copia local ante carga fallida, confirmación anterior y fallback manual sin migración.
- Servicio: plazos de petición de 10 s, parámetros y rechazo de respuestas cruzadas. UI de factura/presupuesto recupera contenido y limpia al salir de sesión sin reescribirlo al desmontar. Las pruebas del editor sustituyen servicios reales; no realizan peticiones a Supabase.
- Navegador con componentes reales y servicios ficticios: escribir cliente sin datos fiscales, esperar autoguardado, recargar, comprobar bloqueo hasta recuperar y restaurar texto. Fallo simulado conserva entrada; reintentar vuelve a guardado. Simular revisión remota provoca conflicto; revisar ofrece servidor/local, recuperar local explícitamente y confirmar nuevo guardado. Nueva factura sigue sin número.
- Revisados **375×812, 768×1024, 1024×768 y 1280×900** sin desbordamiento horizontal. Mensajes ES/EN, claro/oscuro y acciones apiladas en móvil. Capturas ficticias `borrador-recuperacion-escritorio.jpg` y `borrador-recuperacion-movil.jpg` en visualizaciones del chat. Fixture/config/mock temporales retirados y servidor detenido.

`BILLING_DRAFTS.sql` no se ha aplicado en Supabase. La programación diaria de `purge_billing_recovery()` está pendiente; los tests verifican función/permisos y caducidad lógica, no un job remoto. El navegador usa servicios simulados, no certifica guardado contra BD real; la atomicidad se prueba en PostgreSQL local. E2E autenticado, backup/restore, axe/Lighthouse y auditoría general de lanzamiento siguen pendientes. Sin nuevas animaciones, dependencias, commits ni despliegues. No hay cambios Edge: `check:functions` no corresponde a esta entrega. Retención/despliegue en `entornos.md`.

## Entrega P6 · 24/10/2026 · Selector visible de paletas

El usuario confirmó que no encontraba un selector, no que desaparecieran las entradas al recargar. Se sustituye la selección por tarjetas al pie por un desplegable explícito antes de los HEX. No se cambia SQL, servicios ni permisos.

- `npm test`: **344 tests correctos en 44 archivos**. Regresiones nuevas para factura y presupuesto: paletas previamente cargadas disponibles antes de elegir Personalizada, selector antes de los bloques, aplicación por ID, nombre seleccionado, colores correctos y conservación del logo sin guardar documento/perfil. Adaptadas las regresiones de guardado/reintento/lector al desplegable.
- ESLint de archivos afectados correcto. `npm run build` correcto; se mantiene el aviso previo de tamaño: principal **613,32 KB**, Invoicing **441,60 KB**.
- Navegador con fixture de memoria: desplegable con «Arena y mar» y «Bosque», aplicar ambas y verificar acento resultante. Revisados 375×812, 768×1024, 1024×768 y 1280×900 sin desbordamiento horizontal, ES/EN y claro/oscuro. Captura `selector-paletas-escritorio.jpg` en las visualizaciones del chat.
- Fixture/config/mock temporales retirados y servidor detenido. Sin commits, despliegues, cambios de BD ni dependencias. Esta corrección de UI no necesita otra migración; no se certifica el estado remoto del backend. Continúan los límites de lint global, E2E remoto y auditorías pendientes documentados en las entregas anteriores.

## Entrega P8 · 24/10/2026 · Retícula PDF y reutilización

- Suite final: **378 tests correctos en 50 archivos** (`npm test`). ESLint de los JS/JSX afectados y `git diff --check`, correctos. Build correcta: principal **620,86 KB**, Invoicing **458,36 KB**; continúa el aviso previo de chunk principal superior a 500 KB.
- PDF: pruebas geométricas de factura y presupuesto aseguran que ninguna regla horizontal atraviesa glifos. La regresión exacta con cliente y descripción vacíos comprueba margen común Cliente/Concepto y separador posterior al total.
- PostgreSQL local/PGlite: cuatro pruebas aplican `BILLING_DIRECTORY_CATALOG.sql`, verifican ampliación fiscal, catálogo, instantáneas históricas tras archivar y denegaciones para lector, anónimo, escritura directa y editor de otra compañía.
- Servicios/componentes: filtrado de compañía y archivados, rechazo de respuestas cruzadas, parámetros RPC, búsqueda, selección, alta inline y aplicación de concepto. Factura y presupuesto sustituyen Supabase por servicios simulados en sus pruebas.
- Navegador con componentes reales y datos ficticios: factura y presupuesto revisados a **1280×900**; reglas sin solape y alineación común. Directorio/catálogo y alta inline revisados a **375×812**, sin desbordamiento horizontal. Capturas `pdf-factura-reticula.jpg` y `fase4-reutilizacion-movil.jpg`; fixture y servidor retirados.

`BILLING_DIRECTORY_CATALOG.sql` no se ha aplicado en Supabase. La comprobación visual usa datos ficticios y no certifica sesiones remotas. E2E autenticado, backup/restauración, axe/Lighthouse y puertas generales de lanzamiento siguen pendientes. Sin funciones Edge, dependencias nuevas, commits ni despliegues.

## Entrega P9 · 24/10/2026 · Duplicación y plantillas

- Suite final: **388 tests correctos en 54 archivos** (`npm test`). ESLint de los JS/JSX afectados correcto. Build correcta: principal **622,77 KB**, Invoicing **465,60 KB**; continúa el aviso previo de chunk principal superior a 500 KB.
- Duplicación: factura y presupuesto copian contenido e identidad, regeneran IDs, eliminan procedencia y dejan emisión/vencimiento vacíos. La UI no llama al guardado al duplicar y exige fechas antes de confirmar. La confirmación idempotente de P7 y la prueba SQL de conversión única siguen verdes.
- Plantillas: pruebas puras de aplicación y reordenación conservando IDs; componente de búsqueda/aplicación/guardado; servicio con ámbito por compañía y rechazo de respuestas cruzadas.
- PostgreSQL local/PGlite aplica `BILLING_CHAPTER_TEMPLATES.sql`: valida snapshots, archivo sin romper presupuestos, contenido inválido y denegaciones para lector, otra compañía y escritura directa.
- La fixture temporal se levantó para revisión visual, pero el navegador integrado no pudo alcanzar localhost y Chrome/Edge redirigieron a una sesión existente sin producir captura. La fixture y el servidor se retiraron. Se verificaron la reorganización móvil mediante CSS Module y el DOM/acciones mediante happy-dom; queda pendiente la inspección visual manual en navegador real.

`BILLING_CHAPTER_TEMPLATES.sql` no se ha aplicado en Supabase. E2E autenticado, revisión visual manual, backup/restauración, axe/Lighthouse y puertas generales de lanzamiento siguen pendientes. Sin funciones Edge, dependencias nuevas, commits ni despliegues.

## Entrega P10 · 24/10/2026 · Logs, cobros e historial

- Suite final: **395 tests correctos en 57 archivos** (`npm test`). Las 9 Edge Functions compilan y el verificador confirma que no contienen `console.log/info/debug`. Build correcta: principal **625,35 KB**, Invoicing **475,40 KB**; continúa el aviso previo del chunk principal superior a 500 KB.
- PostgreSQL local/PGlite aplica `BILLING_PAYMENTS_HISTORY.sql`: cobro parcial, saldo, pago completo, sobrecobro denegado, reintentos idempotentes con respuesta completa, reversión append-only y motivo, eventos, restauración de borrador como revisión nueva y denegaciones para lector/otra empresa.
- Servicios/componentes: ámbito de compañía validado, historial de facturas y presupuestos en páginas de 50, actor/versión/cambios visibles, alta y reversión de cobro, razón obligatoria y recuperación con error conservado. La lista separa estado documental y financiero y usa los saldos del servidor.
- `npm run lint` global sigue fallando por 10 errores y 6 avisos previos fuera de esta entrega (`.design-preview`, `AuthGuard`, perfiles, contextos, `ItemDetail`, `ResetPassword` y `userService`). Los archivos modificados en P10 se comprueban aparte; `git diff --check` es correcto.

La captura de Usage no muestra exceso: 0,02/1 GB de ingesta y 12,40/100 GB consultados. Se retiraron datos dinámicos de los errores de Edge y logs informativos. `BILLING_PAYMENTS_HISTORY.sql` y las funciones modificadas no se han desplegado. La inspección visual manual/E2E autenticada y backup/restauración siguen pendientes. El circuito rectificativo se ha revisado con AEAT/BOE, pero no se implementa hasta decidir serie, método y encaje VERI*FACTU. Sin commits ni despliegues.

## Entrega P11 · 24/10/2026 · Revisión de coherencia y manual

- `npm test`: **394 pruebas correctas en 58 archivos**. Incluye el bloqueo UI de edición/cancelación de emitidas y pagadas y las pruebas PostgreSQL locales de la migración de inmutabilidad; también se corrige el test para localizar el selector de estado por su opción, no por ser el primer desplegable del formulario.
- ESLint dirigido a `Invoicing`, `BillingDocumentForm`, `BillingFinancePanel` y utilidades de fechas: correcto. `npm run build` había terminado correctamente antes del ajuste exclusivo del selector del test; permanece el aviso de chunk principal superior a 500 KB.
- `git diff --check`: correcto. Solo avisos de normalización LF/CRLF de Git.
- Alineación de los controles de búsqueda de cliente y concepto corregida mediante overrides locales. El uso de fecha local en el formulario de cobros evita el desfase UTC alrededor de medianoche.
- Revisión responsive lógica de CSS/componentes: columnas y controles pasan a una sola columna en anchos estrechos, acciones se adaptan y la previsualización cambia de panel a pestaña. La página web no estuvo accesible en navegador local para confirmar visualmente PC/tablet/móvil; no se presentan como validadas capturas nuevas. La captura de referencia es anterior a la corrección.
- PDF de uso: 8 páginas A4, renderizadas a PNG y revisadas visualmente; contiene capturas suministradas/ejemplos locales y una nota que advierte que la captura del formulario es anterior al ajuste. `docs/manual-facturacion.md` conserva la versión fuente.
- Supabase remoto no inspeccionado ni modificado. `BILLING_ISSUED_INVOICE_LOCK.sql` es migración local pendiente; antes de aplicarla hay que conciliar cualquier factura histórica marcada `paid` sin movimiento en el historial de cobros.
- Sin commits ni despliegues.
# Entregas 24/10/2026 · rectificativas y Planning

- Suite completa del panel: `npm test` — **401 pruebas correctas en 61 archivos**.
- Pruebas enfocadas tras los últimos ajustes: **25 correctas en 5 archivos**, incluyendo PGlite para numeración/idempotencia/aislamiento de rectificativas y concurrencia, permisos, confirmación y deshacer de movimientos Planning.
- ESLint dirigido a todos los módulos JS/JSX tocados en P12/P13: correcto.
- `npm run build`: correcto. Aviso conservado por el chunk principal **629,74 KB** (>500 KB); Invoicing **481,76 KB**.
- `git diff --check`: correcto en esta revisión. `npm run check:functions`: 9/9 Edge Functions compilan y pasan el verificador.
- PDF del manual integral: 6 páginas A4; portada/índice de rutas con la captura disponible y páginas renderizadas para comprobar la composición. Las demás pantallas se describen desde el código porque el navegador local no estuvo disponible para capturarlas en esta sesión.
- No se consultó ni modificó Supabase remoto; no se desplegaron las migraciones `BILLING_RECTIFYING_INVOICES.sql` ni `PLANNING_TASK_MOVE_UNDO.sql`. Las pruebas PGlite acreditan el comportamiento local, no la configuración/estado del entorno compartido.

## Entrega P14 · 26/10/2026 · Cola de recordatorios

- Suite completa: `npm test` — **413 pruebas correctas en 64 archivos**. La prueba SQL de cola limpia el estado de cada caso para evitar que trabajos pendientes contaminen el resultado de otra prueba.
- Los cinco tests PGlite de `PLANNING_EMAIL_QUEUE.sql` cubren encolado único, reclamación, backoff, reintento con permisos y bloqueo de duplicados cuando Resend aceptó el mensaje pero falló la confirmación local, y cierre conservador de trabajos bloqueados durante 20 horas antes de que venza la idempotencia del proveedor. Los tests del emisor simulan respuestas de proveedor; no hacen peticiones reales.
- La Edge Function conecta localmente los RPC de encolado/reclamación, las lecturas aisladas por compañía, la comprobación de membresía, el envío con clave idempotente y los RPC de éxito/fallo. Planning → Avisos permite consultar fallos de la empresa activa; editor/admin pueden reintentar los rechazos confirmados. `sent_marker_failed` queda visible para conciliación y no ofrece reenvío.
- ESLint dirigido a componentes, servicios y tests de avisos y `npm run check:functions`: correctos; **9/9** Edge Functions compilan. `npm run build` correcto; principal **633,15 KB**, Invoicing **481,76 KB**, continúa el aviso del chunk principal sobre 500 KB. `npm run check:production-output` y `git diff --check`: correctos.

El usuario autorizó enviar a Resend los datos necesarios de la tarea, empresa y cliente para los recordatorios. No se mandó ningún correo real ni se conectó a Resend, Supabase remoto, DNS o cron desde esta entrega. La migración y la función no están desplegadas; tampoco se revisó visualmente la pestaña nueva en navegador. Activación, prueba supervisada, configuración DNS y purga programada siguen pendientes. Sin commits ni despliegues.
## Entrega P20 parcial · Blog y SEO · 26/10/2026

- `npm test`: **422 tests correctos en 68 archivos**. Las pruebas nuevas ejecutan `CONTENT_SEO_FIELDS.sql` dos veces en PGlite y comprueban unicidad/aislamiento de slugs, validación de SEO y preservación de `published_at`.
- ESLint global correcto. Build correcta; aviso actual de chunks >500 KB: paquete principal 637,54 KB, Analytics 412,63 KB, XLSX 429,19 KB e Invoicing 482,16 KB. No se ajustó el umbral ni se hizo división de chunks en esta fase.
- `check:production-output` confirma que el bundle no contiene source maps ni archivos de galería de diseño.
- No hubo revisión en navegador autenticado ni captura visual de esta interfaz; el build y tests no sustituyen esa comprobación. No se aplicó la migración a Supabase ni se conectaron las rutas públicas de proyectos cliente.

Esta entrega cubre implementación local del gestor Blog y campos SEO en panel. RLS vigente permanece como control de acceso; la migración aditiva se debe aplicar antes de desplegar estos cambios. Sin commits ni despliegues.
# Entrega P21 parcial · CRM Contactos y pipeline · 26/10/2026

- `npm test`: **430 tests correctos en 69 archivos**. PGlite aplica dos veces `CRM_CONTACTS_PIPELINE.sql`; siete pruebas verifican alta y normalización, vínculo por email/teléfono, conflicto ambiguo, resolución manual, actividad, backfill de cerradas antiguas, tenant/RLS y protección del vínculo. El test de Planning confirma el diagnóstico seguro de la Edge Function.
- `npm run lint`: correcto. `npm run build`: correcta; se mantiene el aviso de chunks >500 KB (principal 643,16 KB; Analytics 412,63 KB; XLSX 429,19 KB; Invoicing 482,16 KB). `npm run check:functions`: 9/9 Edge Functions compilan.
- No se revisó `/contacts` en navegador autenticado ni tamaños móvil/tablet. El flujo de envío desde un sitio cliente no se probó contra una función real; la migración CRM permanece local. La Edge Function con el diagnóstico SQLSTATE tampoco está desplegada.

Sin commit ni despliegue. Los datos existentes de `lead` se conservan; el backfill los enlaza o deja en revisión si hay ambigüedad. La actividad de presupuestos/facturas todavía no está enlazada al contacto.
# Verificación 26/10/2026 · manual integral del panel

- `output/pdf/manual-uso-facturacion.pdf`: PDF A4 de 7 páginas, generado desde `docs/manual-facturacion.md`; las siete páginas se renderizaron con Poppler y se inspeccionaron visualmente. Cubre navegación, dashboard, items, Mi información, Blog, Leads, CRM/privacidad, Planning, presupuestos, facturas, cobros, recordatorios, analítica, usuarios, módulos, perfil y resolución de errores.
- La portada usa una captura de facturación anterior con flechas de revisión y un PDF de ejemplo; el pie de imagen advierte que no son evidencia visual actual. No se obtuvieron capturas autenticadas de las demás áreas. Sus instrucciones se contrastaron con el código local, por lo que no se valida aquí su aspecto en producción ni el estado remoto de cada migración.
- La sección VERI*FACTU se contrastó con la nota y FAQ de AEAT consultadas el 26/10/2026: el anuncio ministerial de 05/10/2026 describe una previsión de ampliar plazos; la nota oficial seguía recogiendo los plazos legales vigentes de 1/1/2027 y 1/7/2027. No se presenta la previsión como cambio normativo aprobado.
- `git diff --check`: correcto. Sin commits ni despliegues.

# Verificación 26/10/2026 · resumen semanal

- `npm test`: **469 pruebas correctas en 78 archivos**, incluidas seis pruebas nuevas para resumen email y migración, PGlite idempotente, roles, cola semanal, aislamiento de conteos, baja y reintentos agotados. La suite mostró dos `ENOTFOUND` al intentar alcanzar el proyecto Supabase remoto; finalizó con código 0. Ese error impide considerar probado el backend remoto.
- `npm run lint`: correcto. `npm run build`: correcto; chunk principal **669,98 KB** (aviso de Vite sobre 500 KB). `npm run check:functions`: **11/11 Edge Functions compilan**.
- El emisor incluye correos de administradores activos y conteos permitidos; destinatarios/estadísticas no persisten en cola. No se envió email ni se comprobaron Vault/cron/despliegue en Supabase. La configuración por pantalla se eliminó después; el envío será automático cuando se apliquen las migraciones nuevas.
- `git diff --check`: correcto. Sin commit ni despliegue.

# Revisión responsive del CRM · 26/10/2026

- En `Contacts.module.css`, hasta 850 px el historial de documentos conserva el nombre/número en la primera fila y coloca estado, fecha y acción en una segunda fila; la fecha puede partirse sin forzar el ancho del modal.
- La configuración de etapas deja de exigir seis columnas hasta 850 px y envuelve sus controles, manteniendo botones de al menos 44 px. La ficha ya apilaba datos e historial en ese mismo breakpoint.
- `npm test`: **469 pruebas correctas en 78 archivos**; la suite registra dos `ENOTFOUND pakbxfdewswzkipeddhr.supabase.co` y finaliza correctamente. `npm run lint`: correcto. `npm run build`: correcta; persiste el aviso de bundle principal de 669,98 KB (>500 KB). `git diff --check`: correcto.
- Verificación estática del CSS/JSX y build local; no hubo sesión autenticada en navegador para confirmar visualmente 375/768/1024/1280 px. La auditoría transversal completa sigue pendiente.
- Revisión adicional: el CSS Module no definía `search`, `notice`, `results`, `detail`, `impact`, `actions`, `confirm`, `success` ni `empty`; esas secciones se mostraban sin los estilos de página. Se añadieron retícula de búsqueda alineada, aviso y resultados legibles, ficha con resumen, confirmación diferenciada y breakpoints hasta 560/760 px. Test estructural comprueba las 16 clases referenciadas; `npm test -- --run src/pages/CrmPrivacy.test.jsx`: **3 pruebas correctas**; ESLint del test correcto. Sin sesión autenticada, así que no se afirma validación visual.

Sin SQL, commits ni despliegues.

# Revisión del orden de migraciones · 26/10/2026

- Se contrastó la secuencia documentada con los 33 ficheros de `database/migrations/` y con las dependencias explícitas de `COMPANY_MODULES.sql`, `PLANNING_EMAIL_QUEUE.sql`, `BILLING_DUE_REMINDERS.sql` y `WEEKLY_SUMMARY_EMAIL.sql`.
- `COMPANY_MODULES.sql` queda después de `PLANNING_TASK_MOVE_UNDO.sql`, `PLANNING_EMAIL_QUEUE.sql`, CRM, facturación, analítica y sus tablas dependientes. Los cron quedan al final, después de desplegar cada Edge y configurar Vault.
- La guía advierte que una base existente requiere consultar el historial y ejecutar solo migraciones pendientes; no se debe volver a pegar la secuencia de instalación completa.
- `npm test -- --run tests/database/companyModules.test.js tests/database/planningEmailQueue.test.js`: **11 pruebas correctas en 2 archivos**, incluidas dependencias/denegaciones de módulos y operaciones de la cola.
- Revisión documental/estática; no se ejecutó SQL local ni remoto ni se consultó el estado de Supabase. El inventario automático encontró los **33/33** nombres de migración en `database/README.md`.

# Accesibilidad del editor documental · 26/10/2026

- Prueba de componente: el selector Editar/Vista previa se expone como `group` con el nombre traducido y el encabezado recibe el foco al abrir el editor. `npm test`: **470 pruebas correctas en 79 archivos**; dos intentos de la suite contra Supabase terminaron `ENOTFOUND`, por lo que no se verifica el servicio remoto.
- `npm run lint`: correcto. `npm run build`: correcta; el bundle principal sigue en **669,98 KB** y conserva el aviso de Vite sobre chunks mayores que 500 KB.
- Revisión manual del selector CSS confirma que ya no hay una regla local que elimine el indicador de foco del encabezado. No sustituye auditoría axe, teclado completa ni revisión visual autenticada.
- Se añadió `tests/database/migrationRunbook.test.js`: valida que los 33 ficheros estén documentados y que dependencias Planning/CRM/facturación precedan a módulos, recordatorios y cron. **3 pruebas dirigidas correctas**.

# Preflight de SEO del blog · 26/10/2026

- `maintenance/CONTENT_SEO_FIELDS_AUDIT.sql` es una consulta de solo lectura que encuentra posts publicados sin slug válido y colisiones por empresa. La prueba PGlite verifica que identifica una publicación histórica sin slug y no incluye un borrador.
- `CONTENT_SEO_FIELDS.sql` continúa sin backfill automático de slug: no inventamos rutas ni decidimos colisiones por la empresa. El informe se ejecuta después de esa migración y antes de integrar cada web pública.
- Sin consultas ni cambios en Supabase remoto.

# CRM: cronología unificada · 26/10/2026

- La ficha del contacto mezcla actividades CRM y facturas/presupuestos vinculados en una cronología ordenada por fecha; las fechas de documento sin hora se muestran sin desplazamiento de zona horaria.
- `CRM_REVIEW_ACTIVITY_LINK.sql` añade un trigger idempotente: al resolver manualmente una solicitud ambigua, el mensaje y la fecha originales pasan a una actividad asociada al contacto seleccionado. El registro huérfano de revisión queda en la bandeja como traza.
- `npm test -- --run tests/database/crmContactsPipeline.test.js tests/database/migrationRunbook.test.js src/lib/crmTimeline.test.js src/pages/Contacts.test.jsx`: **15 pruebas correctas en 4 archivos**. `npm run lint`: correcto. `npm run build`: correcta; permanece el aviso del bundle principal de 669,98 KB.
- `npm test`: **477 pruebas correctas en 82 archivos**. La ejecución también registró un error DNS `ENOTFOUND pakbxfdewswzkipeddhr.supabase.co` de una comprobación que depende del proyecto remoto; no invalida las pruebas locales y no confirma el estado remoto.
- No se aplicó SQL en Supabase. Para instalaciones existentes, ejecutar solo si falta: `CRM_REVIEW_ACTIVITY_LINK.sql`, después de `CRM_CONTACTS_PIPELINE.sql` y antes de `CRM_PRIVACY_CONTROLS.sql`. No se hicieron commits ni despliegues.

# Resumen semanal: autorización y cobertura del emisor · 26/10/2026

- El usuario autorizó expresamente el envío a Resend de la dirección de administradores activos y métricas agregadas. El payload no incluye nombres/emails de clientes, tareas ni datos de documentos. Los destinatarios adicionales van por BCC.
- `tests/weeklySummaryDelivery.test.js` ejecuta el Edge con cliente RPC y Resend simulados; verifica secreto del cron, destinatarios, clave idempotente por cola/generación, fallo reintentable y resultado incierto sin reenvío automático.
- `npm test -- --run tests/weeklySummaryDelivery.test.js tests/weeklySummaryEmail.test.ts tests/database/weeklySummaryEmail.test.js`: **10 pruebas correctas en 3 archivos**. Sin envío real ni llamadas a Supabase.
- Sigue pendiente desplegar función/migraciones, configurar secretos y Vault, y activar cron en el orden de `database/README.md`; la autorización no activa producción por sí sola.
- Regresión global actualizada el 26/10/2026: `npm test -- --run` — **488 pruebas correctas en 85 archivos**; se registraron dos errores DNS `ENOTFOUND` en comprobaciones que dependen de Supabase remoto, sin fallar las pruebas locales. `npm run lint` y `npm run build` correctos en el estado anterior a la corrección del snippet; Vite mantiene el aviso de chunk principal de **672,17 KB** (>500 KB). `npm run check:functions` correcto: **11/11 Edge Functions compilan**. Sin envío real, SQL remoto, despliegue ni commits.

# CRM: aislamiento de tenant en el endpoint público de leads · 26/10/2026

- `company-site-snippet/api/lead.ts` ya no elige tenant a partir solo del cuerpo público: valida `VITE_COMPANY_ID` del despliegue, rechaza si `company_id` recibido difiere y usa el ID configurado para comprobar empresa e insertar. Si falta la configuración, falla cerrado con 503 antes de consultar la base de datos.
- `company-site-snippet/api/lead.test.ts`: tres regresiones cubren el rechazo previo a Supabase de otro tenant, el insert al tenant configurado y la configuración ausente. Vitest: **3 pruebas correctas**; suite global actualizada arriba. La prueba importa TypeScript con Vitest; ESLint del panel no incluye archivos `.ts` externos a su raíz. No hay TypeScript instalado en el workspace: `npx tsc` intentó descargarlo y falló por `ENOTFOUND registry.npmjs.org`, así que no se afirma una comprobación de tipos independiente.
- Se actualizó `company-site-snippet/LEADS_INTEGRATION.md`: `VITE_COMPANY_ID` debe estar disponible también en runtime del endpoint de Vercel; no es secreto, pero la API lo usa como tenant autoritativo. No requiere SQL ni rotación de secretos. Las webs clientes ya integradas deben confirmar que la variable está configurada en el despliegue antes de copiar la actualización de `api/lead.ts`.
- No se desplegó la función de ninguna web cliente ni se consultó Supabase remoto.

# Privacidad CRM: periodos para revisar retención · 26/10/2026

- `CRM_RETENTION_REVIEW.sql` crea una tabla sin acceso directo para roles de cliente y RPC limitadas a administradores. Cada empresa puede definir periodos de 1–3650 días para solicitudes pendientes de revisión y contactos inactivos. El servidor devuelve conteos sin PII; excluye contactos con próximo seguimiento y considera actividad CRM/documentos vinculados recientes.
- `/settings/privacy` muestra y guarda periodos por empresa en ES/EN. Al cambiar de empresa oculta los valores anteriores mientras carga la configuración nueva. Los periodos sirven para revisión manual; no se ejecutan borrados, anonimización ni cron.
- `npm test -- --run src/pages/CrmPrivacy.test.jsx tests/database/crmContactsPipeline.test.js tests/database/migrationRunbook.test.js src/services/crmPrivacyService.test.js`: **17 pruebas correctas en 4 archivos**, incluyendo permisos negativos, aislamiento entre empresas, inactividad y cambio de empresa en la UI.
- Requiere SQL local `CRM_RETENTION_REVIEW.sql` después de `CRM_PRIVACY_CONTROLS.sql` y `CRM_BILLING_LINKS.sql`, antes de `COMPANY_MODULES.sql`. No se ha aplicado en Supabase.
- `maintenance/CRM_RETENTION_REVIEW_PREFLIGHT.sql` compara dependencias, columnas, funciones, triggers y permisos sin devolver PII ni modificar datos; una prueba asegura que siga siendo de solo lectura.
- La prueba PGlite ejecuta ese preflight antes de CRM y después de CRM/privacidad/vínculos/retención: confirma que detecta ausencia y luego RLS, funciones, trigger y permisos correctos.
- El snapshot local `database/local/DatabaseSQL.sql`, fechado 26/10/2026 13:16, incluye las tablas CRM base, `crm_privacy_audit` y `crm_billing_links`; no exporta funciones/triggers y precede a `CRM_RETENTION_REVIEW.sql`, por lo que no sustituye el preflight contra el destino.
- Verificación global registrada al cerrar esta entrega: `npm test` — **485 pruebas correctas en 84 archivos**; dos comprobaciones remotas registraron `ENOTFOUND`. `npm run lint` y `npm run build` correctos en esa verificación de UI; Vite informó un chunk principal de 672,17 KB (>500 KB). La suite global posterior quedó en 490 pruebas/86 archivos y está documentada en la entrega de acceso de módulos.

# Acceso de módulos y resumen semanal automático · 26/10/2026

- `canManageModules` ahora solo se concede por el claim de administrador del sistema. La navegación oculta Módulos a admins de empresa y editores; la página también comprueba el permiso al acceder directamente.
- `COMPANY_MODULES_PLATFORM_ADMIN.sql` revoca `UPDATE` directo y limita un RPC de cambio al administrador de sistema. Los miembros mantienen lectura necesaria para que el panel pueda ocultar módulos desactivados.
- La pestaña y ruta de Resumen semanal se retiraron. `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` activa empresas existentes/nuevas a las 09:00 Madrid, revoca lectura de ajustes/cola y elimina los RPC de configuración por usuario. El email indica que es automático y ya no ofrece una ruta de baja inexistente.
- Pruebas focalizadas: **28 correctas en 7 archivos**. Suite global: `npm test -- --run` — **490 correctas en 86 archivos**; dos pruebas que dependen de Supabase remoto registraron `ENOTFOUND`. `npm run lint` correcto; `npm run build` correcto con aviso del chunk principal de 669,44 KB; `npm run check:functions` correcto, **11/11**.
- Se regeneró `output/pdf/manual-uso-facturacion.pdf` desde `docs/manual-facturacion.md`; el PDF tiene 7 páginas. Renderizadas e inspeccionadas las páginas del mapa, permisos y resumen; sin la antigua ruta `/settings/weekly-summary`.
- SQL remoto pendiente. Después de `COMPANY_MODULES.sql`, ejecutar `COMPANY_MODULES_PLATFORM_ADMIN.sql`. Tras `WEEKLY_SUMMARY_EMAIL.sql`, ejecutar `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`; el cron requiere Edge/Vault y queda para el final. El resultado remoto del preflight CRM indica que solo falta `CRM_RETENTION_REVIEW.sql` entre las migraciones CRM comprobadas. Sin commits ni despliegues.

## Corrección de migración de resumen semanal · 26/10/2026

- La primera ejecución remota de `WEEKLY_SUMMARY_EMAIL.sql` falló porque una función existente usa el parámetro `p_send_time` y la versión nueva lo renombraba a `p_local_send_time`. PostgreSQL no permite cambiar el nombre de entrada con `CREATE OR REPLACE`.
- El siguiente intento detectó otro contrato heredado: `get_company_weekly_summary_payload(uuid)` tenía columnas OUT distintas. La migración ahora elimina/recrea por firma ambas RPC y también las otras RPC de resultados tabulares, cuyos tipos de fila tampoco se pueden cambiar con `CREATE OR REPLACE`; los permisos se vuelven a conceder al final.
- Regresión PGlite: se simulan nombres y resultados OUT heredados, se vuelve a aplicar la migración y se valida además la migración automática; **4 pruebas correctas** en `tests/database/weeklySummaryEmail.test.js`.
- En Supabase, volver a ejecutar únicamente `database/migrations/WEEKLY_SUMMARY_EMAIL.sql` con esta corrección. Si termina bien, seguir con `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql`; cron y despliegue continúan aparte. No se ejecutó SQL en Supabase.
- El siguiente intento completo llegó a `complete_company_weekly_summary(uuid,text)` y detectó que la versión remota conserva el default del segundo parámetro. La migración local ahora mantiene `p_provider_id text default null`; la misma prueba PGlite cubre ese default heredado. Ejecutar el archivo completo, no solo la selección del editor.

## Aprobación pública de presupuestos · cobertura de componente · 26/10/2026

- `QuoteApproval.test.jsx`: enlace inválido no llama al servicio; un fallo de respuesta conserva nombre/email; el reintento muestra la decisión final y elimina el token del fragmento URL. Suite focalizada: **2 pruebas correctas**; ESLint del archivo correcto.
- Campos, radios, confirmación y botón tienen mínimo 44 px; el layout cambia a una columna en móvil. `npm run build` correcto; continúa aviso de bundle principal de 669,44 KB. La prueba de navegador local acabó en `ERR_CONNECTION_TIMED_OUT` y el entorno denegó el socket, así que queda pendiente la inspección visual autenticada.

## Verificación secuencial 2 · aprobación de presupuestos · 26/10/2026

- La suite dirigida previa pasó **9 pruebas** (PGlite, servicio y componente); cubre seguridad del token, roles/tenant, expiración, revocación, aceptación/rechazo, identidad declarada y reintento.
- Se añade `BILLING_QUOTE_APPROVAL_PREFLIGHT.sql`, que devuelve solo indicadores booleanos de tablas/columnas/índices/trigger/RPC/RLS/grants y no consulta contenido de presupuestos ni datos declarados.
- Prueba nueva PGlite ejecuta el preflight tras aplicar dos veces la migración y valida todos los indicadores: `npm test -- --run tests/database/billingQuoteApproval.test.js tests/database/migrationRunbook.test.js` — **10 pruebas correctas**.
- Actualización remota: el usuario ejecutó el preflight en Supabase; los 13 resultados son `true`. Quedan confirmados RPC, trigger, RLS, grants y objetos. No repetir `BILLING_QUOTE_APPROVAL.sql`. La ruta Vercel sigue sin verificarse; falta una prueba real de la ruta y de la traza con un presupuesto de prueba dedicado.

## Accesibilidad transversal · corrección de formularios · 26/10/2026

- En CSS Modules, `.field` se estaba interpretando como una clase local aunque los componentes reciben la clase global `field`. Se corrigió con `:global(.field)` en facturación reutilizable, plantillas, CRM, privacidad, aprobación pública y enlace de aprobación.
- Esto restablece el margen previsto en los campos de formulario y evita que el margen global desplace verticalmente los botones alineados al borde inferior; también restablece `min-width:0` y altura mínima en los controles correspondientes.
- Verificación del panel: `npm test` **493 pruebas correctas en 87 archivos**, `npm run lint` correcto y `npm run build` correcto. Algunas pruebas intentan conectar con `pakbxfdewswzkipeddhr.supabase.co` y muestran `ENOTFOUND`; no son una verificación del estado remoto. Vite mantiene el aviso del chunk principal de **669,44 KB**, superior al objetivo de 500 KB.
- No hubo sesión de navegador autenticada en los anchos 375/768/1024/1280 px; esta corrección no marca completa la auditoría visual/responsive.

## Alta de cliente desde presupuesto · 26/10/2026

- El panel de reutilización estaba renderizando un `<form>` dentro del formulario del editor. El evento `submit` del alta de cliente burbujeaba y ejecutaba también el guardado del presupuesto.
- El formulario interno se sustituyó por un grupo de controles; el guardado valida los campos y el botón es `type="button"`. Enter en un campo ejecuta el alta sin enviar el presupuesto.
- `npm test -- --run src/components/BillingReusePanel.test.jsx src/services/billingReuseService.test.js src/components/QuoteLinesEditor.test.jsx`: **6 pruebas correctas**. ESLint focalizado de `BillingReusePanel.jsx` y su test: correcto.
- No se guardaron datos en Supabase ni se hizo prueba visual autenticada. Sin cambios SQL, commit ni despliegue.

## Aprobación de presupuestos, respuestas sucesivas y notificaciones · 26/10/2026

- La migración nueva `BILLING_QUOTE_APPROVAL_REVISIONS.sql` se aplica después de `BILLING_QUOTE_APPROVAL.sql`. PGlite aplica ambas dos veces, prueba rechazo → guardar versión revisada/enviar → aceptar, verifica estado final e historial de dos decisiones, valida destinatarios autorizados de Resend y permiso service-role para notificar.
- `BILLING_QUOTE_APPROVAL_PREFLIGHT.sql` se actualiza para revisar las nuevas columnas/RPC y sus grants. El usuario debe volver a ejecutarlo tras la migración de revisiones; el resultado anterior solo cubre la versión previa.
- Comprobación dirigida: `npm test -- --run tests/database/billingQuoteApproval.test.js src/components/BillingReusePanel.test.jsx src/services/quoteApprovalService.test.js src/pages/QuoteApproval.test.jsx` — **16 pruebas correctas**. Tras actualizar preflight y añadir la prueba de color: suite puntual **14 pruebas correctas** entre aprobación/migration-runbook/contraste.
- `npx eslint` en los componentes/servicios modificados: correcto. `npm run check:functions`: **13/13 Edge Functions compilan**. `npm run build`: correcto; chunk principal **673,77 KB**, conserva aviso de Vite (>500 KB).
- Prueba de tokens comunes en claro/oscuro (`tests/accessibility/colorTokens.test.js`) verifica texto, botones, estados y bordes contra límites WCAG AA/contraste no textual; no sustituye un escaneo completo de todos los estilos.
- No se probó el correo real ni se desplegaron las funciones. No se pudo completar la revisión visual autenticada en navegador; siguen pendientes los anchos 375/768/1024/1280 y la interacción real en Vercel.

## Verificación secuencial 1 · Blog · 26/10/2026

- Suite dirigida: `npm test -- --run tests/database/contentSeoFields.test.js src/lib/contentSeo.test.js` — **7 pruebas correctas**. Comprueba restricciones/índices/trigger en PGlite y helpers de slug/preview; no prueba el panel en navegador ni consulta Supabase.
- La copia `database/local/DatabaseSQL.sql` incluye las columnas SEO de `items` y `blog_posts`, pero no refleja los checks, índices únicos y trigger añadidos por `CONTENT_SEO_FIELDS.sql`; no usarla como prueba de despliegue completo.
- Contrato cliente: `company-site-snippet/BLOG_INTEGRATION.md`. No hay proyecto de web cliente en este repositorio para verificar rutas públicas, prerender, OG/canonical o sitemap.
- La captura de producción mostró botones de filtro de texto afectados por la regla global `.segmented button { width:2.5rem }` y un `<span class="sr-only">` visible porque la clase no estaba definida. Blog fija ahora ancho al contenido, mínimo táctil 44 px y scroll horizontal accesible; el grupo se apila antes de 1040 px. Se añadió la utilidad global `.sr-only`, también usada por etiquetas de búsqueda CRM.
- `npm run lint`, `npm run build` y las 7 pruebas SEO dirigidas pasan; Vite aún advierte que el chunk principal es 669,44 KB (>500 KB). Cambios solo locales; la captura de producción no se repitió porque no se desplegó a Vercel.

## Marca y edición de emails para clientes · 26/10/2026

- La prueba PGlite ejecuta `COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql`, confirma denegación de lectura directa y de RPC a editor/otra empresa, permite guardar/leer como admin de empresa y plataforma, rechaza contraste insuficiente e imagen PNG falsificada, y verifica autor, restauración y tope de diez versiones. Ejecuta también el preflight y espera todos los indicadores en `true`.
- El renderizador cubre email de presupuesto/factura, ES/EN, placeholders, escapado, lista permitida HTML/enlaces, rechazo de placeholders desconocidos/malformados, texto plano, logo CID, dos layouts y contraste del rótulo sobre acento claro. La vista UI verifica el límite admin, la previsualización sin envío y guardado en la misma pantalla.
- `npm test -- --run src/lib/customerEmailTemplate.test.js src/pages/CustomerEmailSettings.test.jsx tests/database/migrationRunbook.test.js tests/database/customerEmailSettings.test.js`: **24 pruebas correctas en 4 archivos**. `npm run lint` correcto. `npm run build` correcto; Vite mantiene aviso de chunk principal **681,48 KB** (>500 KB). `npm run check:functions`: **13/13** funciones Edge compilan. `git diff --check` correcto (avisos informativos LF/CRLF).
- Solo verificación local. No se aplicó la migración en Supabase, no se desplegó Vercel/Edge ni se enviaron correos. No se probó visualmente en Gmail/Outlook/Apple Mail; esa QA queda pendiente.
- Orden para activar: `database/migrations/COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql`, después `database/maintenance/COMPANY_CUSTOMER_EMAIL_TEMPLATES_PREFLIGHT.sql`, y luego despliegue conjunto del panel y las funciones `send-quote-approval-link` y `send-billing-due-reminders`. Ejecutar solo después de sus dependencias ya instaladas y según `database/README.md`.

## Indicadores de foco de teclado · 26/10/2026

- El `outline:none` del input de búsqueda dentro del selector múltiple eliminaba el indicador global de foco. Se resalta ahora su contenedor con `:has(input:focus-visible)`; tarjetas con enlaces extendidos ya exponen un borde al recibir foco y tienen una regresión para mantenerlo.
- `npm test -- --run tests/accessibility/focusIndicators.test.js`: **2 pruebas correctas**. Revisión estática; no se midió el contraste del anillo en captura ni se recorrió todo el panel en teclado/navegador.

## Suite global reproducible · 26/10/2026

- La suite completa `npm test -- --run` pasa **523 pruebas en 93 archivos**. En una ejecución inicial, dos casos de `Invoicing.test.jsx` llamaban sin querer la RPC real de auditoría de presupuestos; se añadieron dobles del servicio de aprobación para aislarlos. La segunda ejecución pasa sin consultas DNS a Supabase.
- `npm run lint` y `git diff --check` pasan. No se cambió configuración, datos ni servicios remotos.

## Alineación del enlace de aprobación · 26/10/2026

- Se fijan la altura del campo y del botón «Copiar enlace» a 44 px y una altura de línea explícita para la etiqueta. Esto evita que estilos globales de input y botón creen alturas diferentes en esa fila.
- `npm test -- --run src/pages/QuoteApproval.test.jsx src/pages/Contacts.test.jsx src/pages/CrmPrivacy.test.jsx src/components/BillingChapterTemplates.test.jsx src/components/BillingFinancePanel.test.jsx src/components/BillingReusePanel.test.jsx`: **13 pruebas correctas en 6 archivos**. `npm run lint` y `npm run build` correctos; Vite conserva la advertencia previa de chunk principal de **681,48 KB** (>500 KB).\n- No se capturó navegador en esta corrección. La inspección de alineación a 375/768/1024/1280 px sigue pendiente; no se marca cerrada la fase transversal.

## Alineación de formularios · 26/10/2026

- Se fijan a 44 px las alturas de controles vecinos (input y botón) en filas de aprobación de presupuestos, reuso y plantillas de billing, búsqueda de privacidad CRM, contactos/etapas y reversión de cobros. La etiqueta del enlace privado usa una altura de línea explícita.
- Es una corrección por inspección estática de CSS/JSX. No se ejecutaron pruebas ni se capturó navegador en esta entrega; la revisión visual a 375/768/1024/1280 px sigue pendiente. No hay migración SQL asociada.

## Acceso para auditoría visual · 26/10/2026

- El navegador integrado abre http://localhost:5173/settings/emails, pero React Router redirige a /login. La ventana Chrome existente no está disponible para automatización. No se intentó iniciar sesión ni usar credenciales.
- Se conserva la pestaña local en /login para que el usuario pueda autenticarse si quiere que continúe la comprobación visual; la fase sigue abierta hasta inspeccionar las pantallas protegidas en 375/768/1024/1280 px.

## Endpoint público de solicitudes CRM · 26/10/2026

- `company-site-snippet/api/lead.test.ts` cubre tenant fijado por despliegue, configuración ausente, consentimiento con/sin versión, atribución completa, módulo CRM desactivado y honeypot sin acceso a Supabase.
- `npm test -- --run ../company-site-snippet/api/lead.test.ts`: **7 pruebas correctas**. Esto valida el contrato compartido, no prueba los formularios desplegados de los proyectos cliente ni Supabase remoto.

## Avisos de vencimiento · 26/10/2026

- `npm test -- --run tests/database/billingDueReminders.test.js`: **5 pruebas correctas**. PGlite comprueba autorización, offsets, deduplicación de cola, baja por factura, revalidación del módulo/saldo, payload mínimo, marcador idempotente y pausa/reanudación.
- La Edge Function compila con `npm run check:functions`, pero no hay prueba automatizada que simule Resend/HTTP. La prueba PGlite no acredita el despliegue remoto, la ejecución del cron ni un email real.

## Emails al cliente · logo, paletas y CTA · 26/10/2026

- `npm test -- --run src/lib/customerEmailTemplate.test.js src/pages/CustomerEmailSettings.test.jsx` en `admin-panel`: **13 pruebas correctas**. Verifica preview con logo embebido, adjunto CID al enviar, paleta guardada, pie enlazado, no duplicación visible del nombre, layouts distintos y CTA estilizado.
- No se necesita SQL adicional para estos ajustes; se reutiliza la biblioteca existente de paletas. `COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql` sigue siendo la migración inicial pendiente de aplicación remota según la secuencia documentada.
- El navegador local permanece sin sesión y no permite una verificación visual autenticada del panel; el resultado se verificó mediante renderer y pruebas de componente.
- Ajuste visual posterior: logo a escala compacta, en línea con la identidad de empresa y sin bloque aislado. Tests focalizados (13), lint, build y `npm run check:functions` (13/13) correctos; el chunk principal sigue en 681,96 kB.

## CRM · atribución visible · 26/10/2026

- `npm test -- --run src/pages/Contacts.test.jsx src/services/globalSearchService.test.js tests/database/crmContactsPipeline.test.js` en `admin-panel`: **14 pruebas correctas**. La ficha confirma que presenta la ruta, referrer, campaña y los cuatro parámetros UTM; el conjunto de regresión también cubre aislamiento por empresa y permisos en el pipeline.
- Esto solo valida datos que ya llegan al backend. Los tres sitios cliente todavía requieren la integración descrita en `docs/crm-client-form-audit.md`; no se comprobó ningún flujo desplegado ni Supabase remoto.
- Verificación posterior en `admin-panel`: **529 pruebas en 93 archivos**, `npm run lint` y `npm run build` correctos. Sigue el aviso de Vite por el chunk principal de **681,92 kB** (límite informativo 500 kB); no se cambió el code-splitting en esta fase.

## CRM · atribución del item y anonimización · 26/10/2026

- `npm test -- --run tests/database/crmContactsPipeline.test.js ../company-site-snippet/api/lead.test.ts tests/database/migrationRunbook.test.js src/pages/Contacts.test.jsx` en `admin-panel`: **26 pruebas correctas**. La prueba PGlite aplica la migración dos veces, comprueba el preflight, crea el contacto automáticamente, vincula un caso ambiguo y anonimiza una solicitud borrando `source_item`.
- `CRM_LEAD_ITEM_ATTRIBUTION.sql` es una migración nueva; el preflight es de solo lectura. Ambos están pendientes de ejecución en Supabase remoto. No se desplegó ninguna web cliente.
- Suite completa: **530 pruebas en 93 archivos**, ESLint y build correctos; Vite informa el chunk principal de 681,96 kB (>500 kB).
