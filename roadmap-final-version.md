# Roadmap versión final · Facturación y planning

Completa el [MVP](roadmap-mvp.md) y las mejoras aceptadas del [roadmap principal](ROADMAP-FACTURACION-PLANNING.md). Todas las tareas de este archivo son versión final.

24/10/2026 [P3]: fase 2 del MVP comprobada localmente. Esta entrega no completa tareas de versión final ni certifica despliegues.

24/10/2026 [P4]: mejora guiada del selector de colores dentro de la fase 2 del MVP; sin cambios de alcance en esta versión final.

24/10/2026 [P5]: biblioteca de paletas con nombre dentro del MVP, comprobada localmente. No completa tareas de versión final ni despliega su migración.

## Fase 6 · Vencimientos, cobros e historial

24/10/2026 [P7]: fase 3 del MVP comprobada localmente. La auditoría mínima de recuperación no sustituye el historial completo aquí previsto; migración y purga programada pendientes en destino.

24/10/2026 [P8]: fase 4 del MVP y corrección de composición PDF comprobadas localmente. No completa tareas de versión final; la migración de directorio/catálogo está pendiente en destino.

24/10/2026 [P9]: fase 5 del MVP comprobada localmente. La siguiente entrega funcional es la fase 6 de vencimientos, cobros e historial; la migración de plantillas está pendiente en destino.

24/10/2026 [P10]: fase 6 implementada y comprobada localmente salvo el circuito jurídico de anulación/rectificación, que requiere revisar requisitos antes de fijar numeración e inmutabilidad. La migración está pendiente en destino.

24/10/2026 [P11]: revisión local encontró que facturas emitidas podían editarse/cancelarse y marcarse pagadas sin movimiento. UI y nueva migración las hacen inmutables; suite local completa, incluida prueba PGlite. La auditoría visual final en navegador y Supabase remoto no se pudo completar; migración pendiente de aplicar.

24/10/2026 [P12]: rectificativas locales con numeración por empresa, métodos diferencias/sustitución, motivo, referencia y RPC idempotente/inmutable. No se integra VERI*FACTU. Migración pendiente de destino; despliegue sujeto a revisar numeración histórica y datos `paid`.

24/10/2026 [P13]: arrastre/redimensión y deshacer de Planning con confirmación, control de versión y ámbito de serie recurrente. Validado con PGlite; migración pendiente de destino. Revisión visual manual de navegador no disponible en esta sesión.

26/10/2026 [P14, parcial]: cola duradera con reintentos/idempotencia, panel de avisos con permisos y galería de desarrollo; validación local PGlite y pruebas de Edge mock. CI ejecuta lint global, tests, build, exclusión de preview/source maps y compilación Edge. El usuario autorizó el egress a Resend y el código local ya está conectado. Migración/Edge/cron/DNS no desplegados; ejecución remota de CI, prueba visual de galería y UI, E2E, Lighthouse y revisión/backup de destino pendientes.

26/10/2026 [P15, parcial]: logs operativos locales minimizados para facturación/PDF/usuarios y Planning Edge, con código estable, entorno y versión; tests verifican que no se impriman PII, secreto o cuerpo del proveedor. Sin colector externo ni egress de telemetría. Resta decidir proveedor, retención y revisar producción.

26/10/2026 [P16, parcial]: se mejora el layout responsive de la galería dev y se valida build/test/lint/salida de producción. Sin revisión en navegador ni capturas por bloqueo de Computer Use; la casilla de galería permanece pendiente.

26/10/2026 [P17, parcial]: se documentan los límites de métricas y retención. No hay colector/egress ni jobs de purga activos; conservación de documentos e historial requiere decisión contable/legal y el entorno destino aún no está inventariado.

- [x] Listado con filtros de vencidas, pendientes y cobradas parcialmente; saldo y vencimiento claros, sin confundir estado de emisión con estado de cobro. Actualizar `Features.md`.
- [x] Registrar cobros parciales con importe, fecha, método, referencia y actor; servidor calcula saldo, controla concurrencia y evita duplicados/sobrecobros. Actualizar `docs/facturacion-datos.md`.
- [x] Corrección/reversión de cobros trazable con motivo; no borrar silenciosamente movimientos. Actualizar `Features.md`.
- [x] Historial por documento con actor, fecha, acción y cambios; consultas/paginación autorizadas por empresa. Actualizar `docs/facturacion-datos.md`.
- [x] Recuperar versiones de borradores como nuevas revisiones, preservando auditoría y conflictos; documentos emitidos siguen su circuito de corrección. Actualizar `docs/testing.md`.
- [x] Implementar el circuito de factura rectificativa: documento nuevo, serie correlativa por empresa, condición/causa, referencia a la original y rectificación por diferencias o sustitución. Migración y pruebas locales de inmutabilidad/numeración. VERI*FACTU queda fuera mientras se aclara la ampliación normativa anunciada. Actualizar `Features.md` y `docs/facturacion-datos.md`.

## Fase 7 · Planning operativo

- [x] Mover tareas por arrastre y redimensionar duración en día/semana, con feedback de destino y límite de 31 días. Actualizar `Features.md`.
- [x] Alternativa por teclado/táctil con edición de fecha/hora; Escape cancela arrastre y no modifica datos. Actualizar `docs/design-system.md`.
- [x] Deshacer tras confirmar guardado mediante operación inversa validada por versión; no pisar cambios de otro usuario ni actuar tras cambiar compañía. Actualizar `docs/facturacion-datos.md`.
- [x] Para recurrencias, el movimiento confirma explícitamente que afecta a toda la serie (el alcance por ocurrencia queda fuera del soporte actual); recálculo de inicio/fin y pruebas de versión/fecha local. Recordatorios existentes siguen ligados a sus datos de tarea; validar su calendario tras mover en entorno integrado. Actualizar `docs/testing.md`.

## Fase 8B · Operación y estabilización

- [ ] Cola de emails con reintentos/backoff, idempotencia, fallo visible y reintento autorizado; SPF/DKIM/DMARC y autenticación con marca comprobados. Actualizar `docs/emails.md` y `docs/setup-servicios-externos.md`.
- [ ] Galería de componentes y emails exclusivamente de desarrollo, con fixtures y capturas; comprobar ausencia en build de producción. Actualizar `docs/design-system.md`.
- [ ] Monitorizar fallos de guardado/PDF/email con datos personales filtrados, versión y entorno; source maps privados si se habilita proveedor. Actualizar `docs/entornos.md`.
- [ ] Métricas operativas sin contenido fiscal ni PII; política de retención de auditoría, borradores y archivos. Actualizar `docs/facturacion-datos.md`.
- [ ] CI completo de unitarios/componentes/BD/RLS/E2E/capturas/Lighthouse y enlaces internos; pruebas nocturnas en dev y migraciones/funciones por CLI/CI. Actualizar `docs/testing.md`.
- [ ] Revisión adversaria multiempresa, pruebas con latencia/conflictos/reintentos y cuentas desactivadas; comprobación de backups y restauración. Actualizar `AUDITORIA_FACTURACION_SEGURIDAD.md`.
- [x] Manual integral de uso de todo el panel para personal no técnico, incluida recuperación de borradores, Planning, catálogo, presupuestos, facturas, rectificativas, analítica, miembros y preferencias; exportar versión PDF revisada. Capturas disponibles identificadas como referencias y límites de cobertura visual declarados. Actualizado `docs/manual-facturacion.md`.
- [ ] Prueba de extremo a extremo en destino, checklist de entorno/DNS/correo/configuración pertinente y seguimiento de errores tras lanzamiento. Actualizar `database/README.md` y changelog.

No se incluyen pasarelas de pago, firma digital, envío comercial automático ni SEO público: necesitarían alcance propio. Los cobros de esta evolución se registran manualmente.
