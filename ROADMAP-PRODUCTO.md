# Roadmap de producto · Admin Regiamare

Plan para las diez capacidades solicitadas. Es una planificación de trabajo local, no indica que las funciones estén desplegadas. Las migraciones nuevas se aplicarán por separado y solo con verificación y autorización de despliegue.

## Fase 1 · Blog y SEO (MVP)

- [x] Convertir Blog en gestor con estados borrador/publicado/archivado, búsqueda, edición y aislamiento por empresa; conservar permisos existentes.
- [x] Añadir slug, metadatos SEO y fecha de primera publicación para items y posts.
- [x] Crear contrato Markdown para que los sitios clientes implementen `/blog`, `/blog/:slug` y metadatos públicos.
- [x] Añadir preflight SQL de solo lectura para posts publicados sin slug y colisiones antes de activar rutas públicas.
- [ ] Aplicar `CONTENT_SEO_FIELDS.sql` en Supabase y verificar políticas/esquema remoto antes de habilitar producción.
- [ ] Integrar y revisar rutas públicas/prerenderizado en cada proyecto cliente.

## Fase 2 · Contactos y pipeline CRM (MVP prioritario)

- [x] Unificar contactos y actividad: formulario/notas/email/llamadas/visitas, facturas y presupuestos aparecen ordenados en un timeline; la revisión manual conserva allí el mensaje original de la solicitud.
- [x] Vincular solicitudes entrantes por email/teléfono, aislado por empresa; asignar responsable y guardar ruta, referrer, UTM y campaña.
- [x] Pipeline kanban por empresa con etapas iniciales Nuevo → Contactado → Visita → Oferta → Cerrado/Perdido; renombrar, reordenar, crear y archivar etapas vacías.
- [x] Deduplicación segura. Email/teléfono con contactos diferentes requiere resolución manual explícita; no se fusionan registros.
- [x] Migraciones aditivas, RLS y pruebas PGlite negativas entre empresas/roles; el backfill crea/enlaza contactos y mantiene cada lead original.
- [ ] Probar el flujo desde cada formulario cliente con consentimiento/versionado y UTM; desplegar migración tras revisar backup/estado remoto.

## Fase 3 · Privacidad del CRM (MVP coordinado con CRM)

- [x] Guardar consentimiento y contexto de recogida junto al lead, sin inventar base jurídica ni plazos de conservación.
- [x] Exportación JSON y anonimización explícita de datos CRM por contacto, con resumen del alcance, permiso de administrador e idempotencia.
- [x] Proteger registros de facturación e historial que no deban borrarse como efecto lateral de borrar un contacto.
- [x] Configurar por empresa plazos para revisar solicitudes sin vincular y contactos inactivos, con conteos orientativos sin borrado automático.
- [ ] El responsable del tratamiento debe fijar los plazos y criterios aplicables; no se automatizan purgas sin esa decisión y revisión legal/operativa.
- [x] Conectar facturas/presupuestos a contactos para que el historial/exportación pueda incluirlos; la anonimización elimina el vínculo y preserva los documentos emitidos.

## Fase 4 · Operaciones de facturación y comunicación (MVP)

- [x] Aprobación/rechazo de presupuestos por enlace protegido, de un solo uso y con expiración, fecha, identidad declarada del cliente y traza inmutable.
- [x] Avisos de vencimiento configurables localmente: offsets, hora de Madrid, baja por factura, deduplicación, reintentos/idempotencia, panel de fallos y purga.
- [x] El usuario autorizó enviar a Resend solo email, número, vencimiento y saldo; la cola no persiste esos datos y el emisor los relee tras comprobar pago, baja y módulo.
- [ ] Aplicar `BILLING_DUE_REMINDERS.sql`, desplegar Edge y configurar cron/Vault; prueba real de correo e idempotencia todavía pendiente.
- [x] Resumen semanal agregado automático por email a administradores activos: lunes 09:00 Madrid, sin pestaña, módulos respetados, cola semanal, idempotencia y purga.
- [x] El usuario confirma que aplicó `WEEKLY_SUMMARY_EMAIL.sql`, `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` y `WEEKLY_SUMMARY_EMAIL_CRON.sql`, configuró secretos y desplegó `send-weekly-summary`; falta comprobar una entrega real controlada.
- [x] Documentar destinatarios, datos enviados, retención e idempotencia en `docs/emails.md`.

## Fase 5 · Módulos por empresa y búsqueda global (MVP)

- [x] Catálogo central de módulos con todos activados al crear empresa; solo el administrador del sistema puede ver y cambiar su configuración.
- [x] Aplicar configuración a navegación y rutas, además de RLS y barreras de escritura para RPC. La UI no sustituye autorización de servidor.
- [ ] Aplicar `COMPANY_MODULES_PLATFORM_ADMIN.sql` en Supabase después de `COMPANY_MODULES.sql` antes de desplegar el panel actualizado.
- [x] Búsqueda Ctrl+K de items, contactos, facturas y presupuestos, limitada a empresa/módulos accesibles; navegación por teclado y estados de carga/vacío/error.

## Fase transversal · Accesibilidad, móvil y fiabilidad (continua)

- [ ] Auditoría del panel a 375, 768, 1024 y 1280 px; corregir alineación, desbordamiento, tablas, navegación y formularios. Primera corrección aplicada: selectores globales `.field` en CSS Modules que desalineaban controles de facturación, CRM, privacidad y aprobación de presupuestos.
- [x] CRM: la ficha de contacto apila historial y datos hasta 850 px; el historial de documentos y la configuración de etapas pasan a filas adaptables en tablet y móvil, con objetivos táctiles de 44 px.
- [x] Editor de facturas/presupuestos: el selector de modo tiene nombre accesible de grupo y se conserva el indicador de foco del encabezado.
- [ ] Revisar teclado, foco, nombres accesibles, contraste y reducción de movimiento en cada nueva pantalla.
- [ ] Pruebas de migraciones, permisos, errores/reintentos, lint y build en cada fase; revisión visual/E2E autenticada antes de marcarlo terminado.

## Decisiones confirmadas

- CRM: coincidencia de email y teléfono con contactos diferentes requiere revisión manual; no hay auto-fusión ni vinculación ambigua.
- Módulos: todos habilitados por defecto para cada empresa.
- Módulos: solo el administrador del sistema puede ver y cambiar la configuración; las empresas conservan lectura técnica de los flags que necesita el panel.
- Avisos de facturas: desactivados inicialmente; admin configura hasta ocho offsets de -90 a 90 días en `Europe/Madrid` (09:00 inicial). Email, número, vencimiento y saldo son los únicos datos autorizados para Resend; la baja se guarda por factura.
- Aprobación de presupuesto: enlace de 30 días; generar otro revoca los enlaces previos sin respuesta; un solo resultado final. Se recoge nombre/email declarado y opcionalmente el motivo del rechazo. No se afirma una verificación legal de identidad.
- Blog: contenido Markdown, renderizado público seguro, HTML desactivado; la administración no sustituye el prerenderizado SEO de los sitios públicos.
- Resumen semanal: automático cada lunes a las 09:00 de Madrid, dirigido a emails de administradores activos; solo métricas agregadas, autorizado expresamente para Resend. No tiene pestaña ni controles por empresa.
- Pendiente de decisión por el responsable del tratamiento: plazos de conservación CRM y criterios por categoría antes de habilitar purgas automáticas. Las decisiones de caducidad del enlace de presupuesto (30 días), frecuencia configurable de avisos y baja por factura ya están fijadas en la implementación.
