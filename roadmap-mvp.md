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

Implementación existente revisada y completada localmente en [P3]. Las pruebas de persistencia/permisos usan PostgreSQL local (PGlite); no certifican el entorno remoto. La migración `BILLING_APPEARANCE.sql` ya existía y no se ha modificado ni aplicado. Las puertas de lanzamiento siguen pendientes.

- [x] Subir/cambiar/quitar logo desde ajustes accesibles en el editor; validar tamaño, formato y decodificación; proporción y fallback sin logo. Actualizar `Features.md`.
- [x] Añadir Grafito/Océano/Oliva y paleta Personalizada con HEX y muestras, sin colorPicker, con contraste validado. Actualizar `docs/design-system.md`.
- [x] Persistir valores por empresa y copia por documento; personalización individual opcional; fallback del color antiguo. Migración `BILLING_APPEARANCE.sql` comprobada localmente y contrato en `docs/facturacion-datos.md`.
- [x] Aplicar la misma paleta/logo al preview y PDF de ambos tipos, manteniendo las composiciones de referencia. Actualizar `docs/testing.md`.
- [x] [P4] Guiar la personalizada con muestras por rol y bloqueo dinámico por contraste; errores HEX por bloque y revisión adaptable ES/EN. Evidencias en `docs/testing.md`.
- [x] [P5] Guardar paletas personalizadas con nombre por compañía y reutilizarlas en ambos tipos de documento. RLS/RPC y pruebas negativas locales; migración `BILLING_NAMED_PALETTES.sql` pendiente de aplicar en destino.
- [x] [P6] Mostrar un selector explícito de paletas guardadas antes de los bloques de color y separar el guardado al final; carga/selección comprobadas en factura y presupuesto.

## Fase 3 · Autoguardado y recuperación

Implementación local completada en [P7], con contratos y pruebas negativas de servidor. `BILLING_DRAFTS.sql` y la programación de su purga siguen pendientes en destino. Las casillas no certifican despliegue ni completan la auditoría general de fase 0/8.

- [x] Guardar borradores incompletos tras pausa, con identificación estable y recuperación al recargar/volver. Actualizado `Features.md`.
- [x] Mostrar estado de guardado y errores; serializar escrituras, controlar versión, cambios de empresa, desconexión y conflictos entre pestañas. Actualizado `docs/facturacion-datos.md`.
- [x] Recuperación local acotada y remota, borrado/caducidad y limpieza al cerrar sesión; emitir sigue siendo una acción explícita. Evidencias en `docs/testing.md`; retención y despliegue en `docs/entornos.md`.

## Fase 4 · Clientes y conceptos reutilizables

Implementación local completada en [P8]. `BILLING_DIRECTORY_CATALOG.sql` está comprobada en PostgreSQL local y pendiente en destino; las casillas no certifican su despliegue.

- [x] Reutilizar el directorio de clientes existente antes de crear otro; ampliar sus datos fiscales con permisos por empresa. Actualizado `docs/facturacion-datos.md`.
- [x] Buscar/seleccionar cliente y guardar nuevos datos sin abandonar el documento; copiar sus datos al borrador. Actualizado `Features.md`.
- [x] Catálogo de servicios/partidas con descripción, unidad, precio e impuestos; selección/búsqueda rápida y edición puntual en el documento. Actualizado `Features.md`.
- [x] Archivar referencias sin romper documentos históricos; pruebas contra referencias cruzadas entre compañías. Actualizado `docs/testing.md`.

## Fase 5 · Duplicación y plantillas

Implementación local completada en [P9]. `BILLING_CHAPTER_TEMPLATES.sql` está comprobada en PostgreSQL local y pendiente en destino; las casillas no certifican despliegue.

- [x] Duplicar factura/presupuesto en borrador, copiando partidas e identidad; limpiar número/estado/cobros/historial y pedir nuevas fechas. Actualizado `Features.md`.
- [x] Guardar/reutilizar plantillas de capítulos con varias partidas, reordenación con IDs estables y nombres claros. Actualizado `Features.md`.
- [x] Verificar duplicación y conversión idempotentes: un reintento no crea documentos definitivos duplicados. Actualizado `docs/testing.md`.

## Fase 8A · Puerta de entrega MVP

- [ ] Registrar eventos mínimos de creación/edición/emisión desde servidor; preparar base de auditoría antes de automatizar escrituras. Actualizar `docs/facturacion-datos.md`.
- [ ] Verificar RLS/RPC/archivos por rol y empresa, secretos, cabeceras, CORS y límites de endpoints afectados. Actualizar `AUDITORIA_FACTURACION_SEGURIDAD.md`.
- [ ] Verificar datos legales/privacidad y noindex del panel; documentar revisión fiscal necesaria para flujo de emisión/corrección. Actualizar `Features.md`.
- [ ] Revisar recordatorios actuales y matriz de emails: disparador, destinatario, plantilla, idempotencia y modo de pruebas. Crear `docs/emails.md`.
- [ ] E2E de edición/recuperación/descarga/conversión, pruebas PDF y regresiones multiempresa; axe, teclado, reduced-motion, cuatro anchos y ES/EN. Actualizar `docs/testing.md`.
- [ ] Tests, lint, build, compilación Edge, CI mínimo y Lighthouse sobre build; resolver/documentar chunks grandes y dependencias vulnerables existentes. Actualizar `docs/testing.md`.
- [ ] Validar backup/recuperación, despliegue de migraciones/funciones y smoke test con datos de prueba en destino; documentar pasos y pendientes reales. Actualizar `database/README.md` y changelog.
