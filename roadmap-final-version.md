# Roadmap versión final · Facturación y planning

Completa el [MVP](roadmap-mvp.md) y las mejoras aceptadas del [roadmap principal](ROADMAP-FACTURACION-PLANNING.md). Todas las tareas de este archivo son versión final.

## Fase 6 · Vencimientos, cobros e historial

- [ ] Listado con filtros de vencidas, pendientes y cobradas parcialmente; saldo y vencimiento claros, sin confundir estado de emisión con estado de cobro. Actualizar `Features.md`.
- [ ] Registrar cobros parciales con importe, fecha, método, referencia y actor; servidor calcula saldo, controla concurrencia y evita duplicados/sobrecobros. Actualizar `docs/facturacion-datos.md`.
- [ ] Corrección/reversión de cobros trazable con motivo; no borrar silenciosamente movimientos. Actualizar `Features.md`.
- [ ] Historial por documento con actor, fecha, acción y cambios; consultas/paginación autorizadas por empresa. Actualizar `docs/facturacion-datos.md`.
- [ ] Recuperar versiones de borradores como nuevas revisiones, preservando auditoría y conflictos; documentos emitidos siguen su circuito de corrección. Actualizar `docs/testing.md`.
- [ ] Concretar flujo de anulación/rectificación tras revisión de requisitos aplicables, con migración y pruebas de inmutabilidad/numeración. Actualizar `Features.md`.

## Fase 7 · Planning operativo

- [ ] Mover tareas por arrastre y redimensionar duración en día/semana, con feedback de destino y límites de horas. Actualizar `Features.md`.
- [ ] Alternativa por teclado/táctil con edición de fecha/hora; Escape cancela arrastre y no modifica datos. Actualizar `docs/design-system.md`.
- [ ] Deshacer tras confirmar guardado mediante operación inversa validada por versión; no pisar cambios de otro usuario ni actuar tras cambiar compañía. Actualizar `docs/facturacion-datos.md`.
- [ ] Para recurrencias, elegir alcance explícito antes de guardar (ocurrencia/serie según soporte); recalcular recordatorios y comprobar zona horaria, medianoche y horario de verano. Actualizar `docs/testing.md`.

## Fase 8B · Operación y estabilización

- [ ] Cola de emails con reintentos/backoff, idempotencia, fallo visible y reintento autorizado; SPF/DKIM/DMARC y autenticación con marca comprobados. Actualizar `docs/emails.md` y `docs/setup-servicios-externos.md`.
- [ ] Galería de componentes y emails exclusivamente de desarrollo, con fixtures y capturas; comprobar ausencia en build de producción. Actualizar `docs/design-system.md`.
- [ ] Monitorizar fallos de guardado/PDF/email con datos personales filtrados, versión y entorno; source maps privados si se habilita proveedor. Actualizar `docs/entornos.md`.
- [ ] Métricas operativas sin contenido fiscal ni PII; política de retención de auditoría, borradores y archivos. Actualizar `docs/facturacion-datos.md`.
- [ ] CI completo de unitarios/componentes/BD/RLS/E2E/capturas/Lighthouse y enlaces internos; pruebas nocturnas en dev y migraciones/funciones por CLI/CI. Actualizar `docs/testing.md`.
- [ ] Revisión adversaria multiempresa, pruebas con latencia/conflictos/reintentos y cuentas desactivadas; comprobación de backups y restauración. Actualizar `AUDITORIA_FACTURACION_SEGURIDAD.md`.
- [ ] Manual de uso para personal no técnico, incluida recuperación de borradores, plantillas, cobros e historial; exportar versión PDF revisada. Actualizar `docs/manual-facturacion.md`.
- [ ] Prueba de extremo a extremo en destino, checklist de entorno/DNS/correo/configuración pertinente y seguimiento de errores tras lanzamiento. Actualizar `database/README.md` y changelog.

No se incluyen pasarelas de pago, firma digital, envío comercial automático ni SEO público: necesitarían alcance propio. Los cobros de esta evolución se registran manualmente.
