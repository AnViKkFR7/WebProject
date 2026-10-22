# Roadmap MVP · Evolución de facturación y planning

Alcance y decisiones: [roadmap principal](ROADMAP-FACTURACION-PLANNING.md). Todas las tareas de este archivo son MVP; una casilla pendiente no indica que toda la funcionalidad actual falte, sino que falta validar/completar esta evolución.

## Fase 0 · Base y contratos

- [ ] Inventariar permisos, rutas, RPC, estados y despliegues reales; revisar recordatorios pendientes. Actualizar `database/README.md` y `Features.md`.
- [ ] Definir matriz lector/editor/admin/membresía inactiva y contratos de borradores, paletas y auditoría mínima. Documentar en `docs/facturacion-datos.md`.
- [ ] Definir retención/caducidad de borradores y recuperación local, entornos, claves públicas y despliegue/recuperación. Actualizar `docs/entornos.md`.
- [ ] Añadir nuevas migraciones y tests negativos de BD para cada ampliación; mantener compatibilidad con documentos antiguos. Actualizar `database/README.md`.

## Fase 1 · Editor de página completa

Implementación local completada en [P2]. Las puertas de lanzamiento de fase 8 y la comprobación remota de fase 0 siguen pendientes; ver `docs/testing.md`.

- [x] Sustituir modal por rutas de nuevo/edición dentro de la pestaña; volver conserva filtros/paginación/scroll y recargar funciona. Actualizar `Features.md`.
- [x] Separar formulario, estado/servicios y vista de documentos, conservando permisos, emisor, capítulos, descuentos, conversión y descarga. Actualizar `docs/design-system.md`.
- [x] Preview simultáneo en escritorio; alternancia sin pérdida en tablet/móvil; carga diferida y sin bloquear tecleo. Actualizar `docs/design-system.md`.
- [x] Validación por campo, resumen/foco al primer error, conservación de entrada y protección al salir con cambios. Actualizar `docs/testing.md`.

## Fase 2 · Identidad y PDF

- [ ] Subir/cambiar/quitar logo desde ajustes accesibles en el editor; validar tamaño, formato y decodificación; proporción y fallback sin logo. Actualizar `Features.md`.
- [ ] Añadir Grafito/Océano/Oliva y paleta Personalizada con HEX y muestras, sin colorPicker, con contraste validado. Actualizar `docs/design-system.md`.
- [ ] Persistir valores por empresa y copia por documento; personalización individual opcional; fallback del color antiguo. Nueva migración y `docs/facturacion-datos.md`.
- [ ] Aplicar la misma paleta/logo al preview y PDF de ambos tipos, manteniendo las composiciones de referencia. Actualizar `docs/testing.md`.

## Fase 3 · Autoguardado y recuperación

- [ ] Guardar borradores incompletos tras pausa, con identificación estable y recuperación al recargar/volver. Actualizar `Features.md`.
- [ ] Mostrar estado de guardado y errores; serializar escrituras, controlar versión, cambios de empresa, desconexión y conflictos entre pestañas. Actualizar `docs/facturacion-datos.md`.
- [ ] Recuperación local acotada y remota, borrado/caducidad y limpieza al cerrar sesión; emitir sigue siendo una acción explícita. Actualizar `docs/testing.md`.

## Fase 4 · Clientes y conceptos reutilizables

- [ ] Reutilizar el directorio de clientes existente antes de crear otro; ampliar sus datos fiscales con permisos por empresa. Actualizar `docs/facturacion-datos.md`.
- [ ] Buscar/seleccionar cliente y guardar nuevos datos sin abandonar el documento; copiar sus datos al borrador. Actualizar `Features.md`.
- [ ] Catálogo de servicios/partidas con descripción, unidad, precio e impuestos; selección/búsqueda rápida y edición puntual en el documento. Actualizar `Features.md`.
- [ ] Archivar referencias sin romper documentos históricos; pruebas contra referencias cruzadas entre compañías. Actualizar `docs/testing.md`.

## Fase 5 · Duplicación y plantillas

- [ ] Duplicar factura/presupuesto en borrador, copiando partidas e identidad; limpiar número/estado/cobros/historial y pedir nuevas fechas. Actualizar `Features.md`.
- [ ] Guardar/reutilizar plantillas de capítulos con varias partidas, reordenación con IDs estables y nombres claros. Actualizar `Features.md`.
- [ ] Verificar duplicación y conversión idempotentes: un reintento no crea documentos definitivos duplicados. Actualizar `docs/testing.md`.

## Fase 8A · Puerta de entrega MVP

- [ ] Registrar eventos mínimos de creación/edición/emisión desde servidor; preparar base de auditoría antes de automatizar escrituras. Actualizar `docs/facturacion-datos.md`.
- [ ] Verificar RLS/RPC/archivos por rol y empresa, secretos, cabeceras, CORS y límites de endpoints afectados. Actualizar `AUDITORIA_FACTURACION_SEGURIDAD.md`.
- [ ] Verificar datos legales/privacidad y noindex del panel; documentar revisión fiscal necesaria para flujo de emisión/corrección. Actualizar `Features.md`.
- [ ] Revisar recordatorios actuales y matriz de emails: disparador, destinatario, plantilla, idempotencia y modo de pruebas. Crear `docs/emails.md`.
- [ ] E2E de edición/recuperación/descarga/conversión, pruebas PDF y regresiones multiempresa; axe, teclado, reduced-motion, cuatro anchos y ES/EN. Actualizar `docs/testing.md`.
- [ ] Tests, lint, build, compilación Edge, CI mínimo y Lighthouse sobre build; resolver/documentar chunks grandes y dependencias vulnerables existentes. Actualizar `docs/testing.md`.
- [ ] Validar backup/recuperación, despliegue de migraciones/funciones y smoke test con datos de prueba en destino; documentar pasos y pendientes reales. Actualizar `database/README.md` y changelog.
