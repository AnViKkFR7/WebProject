# Verificación de la evolución de documentos

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
