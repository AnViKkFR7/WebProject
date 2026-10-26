# Roadmap de facturación, presupuestos y planning

Actualizado: 26/10/2026. Estado: fases 1–7 implementadas y comprobadas localmente; continúan pendientes las puertas de operación de fase 8. P12 implementa rectificativas, P13 movimiento/deshacer de Planning, P14 parcial prepara cola/CI y P15 añade diagnósticos operativos sin PII ni colector externo. Lint global en CI local; migraciones, despliegues y verificación remota siguen pendientes.

Referencias de trabajo: [DevelopmentBasics.md](DevelopmentBasics.md) y [PLAYBOOK-WEB.md](PLAYBOOK-WEB.md). Se aplican a cada entrega, con el alcance concreto de un panel privado multiempresa ya existente. Las capturas y el PDF de presupuesto aportados siguen siendo las referencias de composición de los documentos.

## Objetivo y alcance

Hacer cómodo el trabajo diario: editar documentos con espacio y previsualización, recuperar trabajo, reutilizar datos, registrar cobros y entender los cambios. Incluye las ocho mejoras propuestas y aceptadas: autoguardado, clientes/conceptos reutilizables, duplicación/plantillas, mover y redimensionar tareas con deshacer, preview en vivo, vencimientos/cobros parciales, historial/versiones y validación comprensible.

MVP significa primera entrega utilizable de esta evolución, no la primera versión del producto. La versión final completa las mejoras aceptadas después de estabilizar ese flujo. No se asignan fechas sin medir el trabajo técnico de cada fase.

## Situación comprobada

- El editor de factura/presupuesto ocupa una vista completa desde [P2], con preview adaptable.
- Existe un perfil de facturación por empresa con logo PNG/JPEG y un color HEX. La subida actual limita el archivo a 1 MB y 4096 px por dimensión; se revisarán también contenido decodificado y errores.
- El PDF ya incorpora el logo; preview y descarga comparten renderizador. La nueva petición amplía la personalización y su accesibilidad en el flujo.
- Existen capítulos con varias partidas, descuentos, numeración y controles de versión/permisos. Se deben conservar y cubrir como regresiones.
- Hay cambios locales y migraciones preparadas. Esta revisión no certifica el estado de producción; el despliegue pendiente de recordatorios debe comprobarse antes del lanzamiento.

## Decisiones de experiencia

**Vista completa para crear y editar.** Al pulsar Nuevo o abrir un documento, el contenido central de la pestaña pasa a ser el editor. Se mantienen sidebar, compañía y contexto del panel. Ruta propia para nuevo/edición, enlace directo y comportamiento correcto de atrás/recargar. Volver al listado restaura filtros, página y posición.

En escritorio ancho: formulario a la izquierda y preview de páginas a la derecha, con anchuras legibles y panel de preview plegable. Cabecera con Volver, título, estado del guardado y acción principal. Guardar borrador es la acción principal durante edición; emitir/convertir requiere confirmación real del servidor. Descargar y otras acciones tienen jerarquía secundaria.

En tablet se divide solo si ambos paneles resultan legibles; de lo contrario se alterna Editar / Vista previa conservando estado y posición. En móvil se usa una columna con ese mismo conmutador. No se encierra un formulario largo dentro de un popup ni se intenta eliminar el scroll natural de un documento extenso. Evitar scrolls anidados innecesarios y acciones tapadas por el teclado.

**Logo y paletas.** Ajustes compartidos para facturas/presupuestos de la compañía, accesibles desde el editor. Subir, sustituir y quitar logo, con vista previa y proporción conservada. Tres propuestas iniciales: Grafito (neutros), Océano (azul contenido) y Oliva (verde sobrio). Cada una define acento, texto, texto secundario, fondo y superficies de tabla. Cuerpos blancos y textos oscuros; el acento no invade grandes fondos.

La opción Personalizada permite escribir HEX por rol y elegir muestras predefinidas. Sin colorPicker. Validación sintáctica en cliente y servidor y contraste legible; los textos de estados no dependen solo del color. Se puede volver a una paleta estándar. El modo oscuro del panel no convierte en oscuro el papel del PDF.

La compañía guarda el valor por defecto; un documento puede personalizarlo sin cambiar ese valor. Al guardar/emitar se conserva una copia de logo y paleta. Cambiar la marca no modifica documentos existentes. Documentos antiguos con solo `issuer.color` mantienen un fallback compatible y no se recolorean silenciosamente.

## Secuencia de entregas

| Fase | Resultado | Dependencias | Clase |
|---|---|---|---|
| 0 | Base, permisos y comprobación de despliegues | Estado real del repo/entornos | MVP |
| 1 | Editor de página completa, preview y validación | 0 | MVP |
| 2 | Logo y paletas en formulario, preview y PDF | 1 | MVP |
| 3 | Autoguardado y recuperación de borradores | 1; auditoría mínima de 0 | MVP |
| 4 | Clientes y catálogo de conceptos reutilizables | 0–3 | MVP |
| 5 | Duplicar documentos y plantillas de capítulos | 2–4 | MVP |
| 6 | Vencimientos, cobros parciales e historial completo | 3–5 | Final |
| 7 | Planning: mover/redimensionar con deshacer | 0; independiente de 2–6 | Final |
| 8 | Operación, correos, rendimiento y lanzamiento | Puertas de calidad de todas las fases | MVP + Final |

Listas ejecutables: [MVP](roadmap-mvp.md) y [versión final](roadmap-final-version.md). Las verificaciones de seguridad y calidad se hacen en cada fase; la fase 8 integra el conjunto.

## Contratos técnicos y seguridad

- Extraer progresivamente el editor de `Invoicing.jsx` a componentes y hooks de dominio; compartir piezas de factura y presupuesto. UI genérica sin negocio, ES/EN, tokens y CSS Modules para componentes nuevos. No reescribir módulos ajenos.
- Validaciones y cálculos puros con casos compartidos cliente/servidor; el servidor valida y calcula importes autoritativos. PDF/preview usan el documento guardado o un borrador explícitamente identificado.
- Nuevas tablas/JSON para paletas, borradores, catálogo, cobros y auditoría requieren migraciones nuevas, contratos versionados, RLS y RPC autorizadas. Funciones nuevas con nombres cualificados y `search_path` restringido.
- Borradores incompletos se validan estructuralmente, sin exigir todavía todos los datos necesarios para emitir. Autoguardado nunca emite, cambia numeración definitiva ni convierte documentos.
- Autoguardado remoto tras una pausa inicial de 1 s; serializar escrituras y controlar versión para que una respuesta antigua no pise una nueva. Estados: cambios pendientes, guardando, guardado, sin conexión y conflicto. Resolver conflictos explícitamente, sin sobrescribir silenciosamente.
- Recuperación local mínima, identificada por usuario/empresa/tipo/documento y con caducidad definida en fase 0. No persistir tokens ni cachear el logo en cada pulsación. Limpiar al salir de sesión/expirar; no recuperar datos de otra cuenta o empresa. Persistencia remota para continuidad entre dispositivos.
- Clientes y conceptos se copian al documento: editar un cliente o precio del catálogo no modifica documentos anteriores. Referencias y claves foráneas deben incluir empresa.
- Registrar cobros de forma transaccional e idempotente; saldo derivado en servidor. Historial append-only con actor, empresa, fecha y versión. Restaurar crea otra revisión; no borra el historial.
- Facturas emitidas conservan contenido, numeración e identidad. Separar borrador editable de corrección/anulación trazable; revisar requisitos aplicables antes de concretar rectificativas. Este roadmap no certifica cumplimiento fiscal.
- Revocar membresía corta accesos remotos y cancela trabajo pendiente en cliente. No aplicar respuestas ni deshacer operaciones después de cambiar de compañía/cuenta.

## Criterios de aceptación transversales

- Flujos reales: nuevo → autoguardar incompleto → recargar → recuperar → completar → preview → guardar/emitir → descargar; duplicar → nuevo borrador; presupuesto → factura sin duplicación por reintento.
- Usuario autorizado de A no lee/modifica recursos de B cambiando IDs, rutas, RPC, referencias o almacenamiento. Usuario inactivo y lector no obtienen escrituras por API directa.
- Errores por campo, resumen accesible y foco/scroll al primero inválido; una petición fallida conserva la entrada. Confirmaciones no informan éxito antes de respuesta real.
- Navegación por teclado, foco visible, contraste, axe y reduced-motion. Revisar 375/768/1024/1280 px, tablet en ambas orientaciones, claro/oscuro y ES/EN. Sin scroll horizontal de página.
- Preview diferido sin bloquear tecleo, descartar resultados obsoletos; lazy load del motor PDF, imágenes con espacio reservado. Medir antes de introducir dependencias/cachés complejas.
- Unitarios significativos, componentes, BD/RLS y E2E con backend simulado; capturas visuales por plataforma. PDF de 1 y varias páginas, textos largos, logos apaisados/verticales, descuentos e impuestos mixtos.
- Tests/lint/build y compilación de Edge Functions según el cambio. Presupuesto de chunks <500 KB o excepción medida y documentada. Lighthouse sobre producción: LCP <2,5 s, CLS <0,1, TBT <200 ms y accesibilidad ≥95; INP se valida con medición de interacciones/uso real.
- Registrar por separado código terminado, migración aplicada, función desplegada y flujo verificado en el entorno destino. Copia de seguridad, plan de recuperación y comprobación posterior al despliegue.

## Aplicación del playbook al alcance

| Área del playbook | Tratamiento |
|---|---|
| Documentación/decisiones | Este índice, MVP/final y `Features.md`; actualizar en cada entrega. Crear docs temáticas cuando se implemente el área. |
| Arquitectura/entornos | Mantener SPA privada; rutas lazy, error boundaries, servicios, caché por tenant, dev/prod separados. No cambiar ramas ni desplegar por crear este plan. |
| Diseño/movimiento | Tokens, catálogo dev de componentes, feedback sutil y reduced-motion. No añadir revelados de scroll a campos de trabajo ni ocultar la primera pantalla. |
| Seguridad | RLS, permisos negativos, secretos/bundle/historial, cabeceras HTTPS y CORS. Rate limiting en endpoints públicos existentes; captcha/honeypot según el flujo público afectado. |
| Pagos | Registro manual de cobros sí; pasarelas, checkout, webhooks y reembolsos de proveedor no aplican a esta fase. No incorporarlos por aparecer en las capturas. |
| Emails | Auditar recordatorios existentes, matriz de plantillas, entorno de pruebas, idempotencia, cola/reintentos y fallos visibles. No enviar documentos a clientes automáticamente al guardarlos. |
| Legal/privacidad | Revisar permisos, retención, exportación, datos personales en logs y avisos existentes; documentar revisión fiscal/legal antes de lanzamiento. Cambios de web pública/consentimiento solo si el flujo los afecta. |
| SEO | Panel privado con noindex, títulos, rutas/404 y recursos de marca. SEO público, páginas por intención, JSON-LD, Search Console y mapas no aplican a este incremento. |
| Analítica | Métricas operativas mínimas sin contenido fiscal ni datos personales. No introducir GA4/píxeles. Auditoría de la analítica pública existente fuera de este alcance. |
| Calidad/operación | CI, pruebas negativas multiempresa, visuales, rendimiento, errores filtrados y manual actualizado; backups y comprobaciones de despliegue. |

## Próxima implementación

Las fases 1–5 están comprobadas localmente. [P9] añade duplicación como borrador y plantillas de capítulos por compañía con copias editables e IDs estables. Evidencias y límites en `docs/testing.md`.

Continuar con fase 8 de operación y estabilización. Antes de desplegar, inventariar el estado remoto y aplicar mediante el proceso autorizado las migraciones pendientes de apariencia, paletas, borradores, directorio/catálogo, plantillas, cobros, bloqueo de emitidas, rectificativas y movimientos/deshacer de Planning. Ningún despliegue se considera verificado por completar código local.
