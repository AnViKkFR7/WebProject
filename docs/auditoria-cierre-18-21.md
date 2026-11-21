# Auditoría · cierre local de hallazgos 18–21

29/10/2026. Implementación local; sin migraciones, despliegues ni correos ejecutados contra servicios remotos. El hallazgo 22 permanece excluido.

## 18 · Métricas semanales

`WEEKLY_SUMMARY_METRICS.sql` cuenta una primera emisión por factura desde el historial verificable, tanto creación emitida como transición posterior. Agrupa antes de filtrar la semana para no volver a contar pagos, reversiones o cambios posteriores. Los históricos cuyo baseline ya está emitido y carecen de fecha verificable quedan fuera; el correo explica este límite.

Las vencidas usan el saldo consolidado de la familia de rectificativas: documento vigente, cobros/reversiones y saldo positivo. Planning cuenta ocurrencias, incluidas series antiguas, dentro de intervalos semiabiertos en Europe/Madrid. El correo aclara que cada repetición cuenta. Mantiene controles de empresa/módulo, lease de diez minutos y recuperación máxima de veinte horas desde el primer intento.

Actualiza también el payload opcional Watch si ya está instalado, sin activarlo ni enviar su prueba. Una definición Watch distinta de la reconocida hace fallar la migración para revisión. No reaplicar después cuerpos antiguos de esos payloads.

## 19 · Búsqueda de privacidad

`CRM_PRIVACY_SEARCH_LITERAL.sql` usa subcadenas literales para nombre y correo: `%`, `_` y barra invertida no son comodines. Solo busca por teléfono cuando la entrada contiene exclusivamente caracteres telefónicos y al menos dos dígitos. Una búsqueda alfabética no se transforma en un teléfono vacío que coincida con todos los contactos. Conserva autorización administrativa, empresa, membresía activa, módulo CRM y límite de resultados.

## 20 · Invitaciones recuperables

`COMPANY_USER_INVITATION_STATE.sql` registra por empresa/correo la cuenta, membresía y estado de solicitud al proveedor por separado. Las RPC son exclusivas de servicio y revalidan al administrador de plataforma; el navegador no accede a la tabla. Valida la empresa antes de crear cuentas. Los bloqueos, token y lease serializan intentos; el índice único evita duplicar el registro de invitación. Un lease vencido queda incierto, sin reenvío automático.

`invite-user` resuelve cuentas existentes por correo y conserva membresías previas, incluidos rol, nombre y suspensión. Nunca borra cuentas para compensar errores. Si la cuenta está confirmada, la vincula sin enviar otra invitación. Para cuentas no confirmadas, distingue `accepted`, `failed` y `unknown`; `accepted` solo acredita aceptación de la petición, no recepción en el buzón. Los fallos parciales devuelven estado recuperable, sin presentarlos como un envío correcto.

El panel conserva los campos, muestra mensajes ES/EN y ofrece reintento/reenvío explícito, ligado al mismo contexto del formulario. Incluso un envío aceptado puede reenviarse explícitamente tras el intervalo mínimo de sesenta segundos. Repetir el envío normal reutiliza el resultado guardado. Un reenvío manual tras resultado incierto puede producir otro correo; no se promete entrega exactamente una vez. Cuentas y membresías se reutilizan.

`SITE_URL` es obligatorio: HTTPS, salvo HTTP local. El destino se fija en servidor a `/reset-password` y debe estar permitido en Auth Redirect URLs. No acepta un redirect suministrado por el cliente. Supabase Auth conserva su configuración SMTP actual. Referencias del contrato nativo: [usuarios Auth](https://supabase.com/docs/guides/auth/users), [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) e [inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).

## 21 · Listado completo de usuarios

`listar-usuarios` exige administrador de plataforma antes de consultar Auth y recorre páginas de cien usuarios. Deduplica IDs y falla ante errores, páginas repetidas o datos inválidos; no entrega una lista parcial como completa. Límite defensivo de mil páginas: al alcanzarlo devuelve error y debe revisarse el volumen, no truncarlo silenciosamente. Los cambios concurrentes en Auth no constituyen una instantánea transaccional; una recarga obtiene el estado posterior.

## Orden de despliegue

1. Revisar el estado efectivo y las dependencias de las entregas previas; respaldar y validar primero en Supabase descartable. Pausar scheduler semanal y esperar a workers anteriores. Conciliar intentos inciertos sin reiniciar claves/generaciones ni forzar reenvíos de cuerpos antiguos.
2. Aplicar `WEEKLY_SUMMARY_METRICS.sql` después de `WEEKLY_SUMMARY_RETRY_WINDOW.sql`, `BILLING_RECTIFICATION_BALANCES.sql` y `PLANNING_RECURRENCE_WINDOW.sql`, además del esquema previo completo.
3. Aplicar `CRM_PRIVACY_SEARCH_LITERAL.sql` después de las migraciones de privacidad, su corrección de anonimización y los controles de módulos/membresías. Aplicar `COMPANY_USER_INVITATION_STATE.sql` después de `COMPANY_MEMBER_ACCESS.sql` y las tablas base de empresas/Auth.
4. Configurar y verificar `SITE_URL` y el destino permitido en Auth. Desplegar `invite-user`, `listar-usuarios` y `send-weekly-summary` (incluye los nuevos textos del renderer compartido). Publicar el panel actualizado antes de reabrir invitaciones y restaurar el scheduler tras las verificaciones.
5. Comprobar con dos empresas y roles activos/suspendidos las denegaciones REST/RPC reales, métricas, paginación posterior a la primera página, cuentas nuevas/existentes, fallos SMTP, reintento explícito y concurrencia. Usar buzones controlados: esta comprobación sí enviará correos reales.

Para instalaciones nuevas, el manifiesto canónico y `database/README.md` incluyen las tres migraciones: 68 pasos. El generador solo produce SQL local; no instala ni activa cron/Watch.

## Evidencia y límites

La batería focalizada ejecuta SQL real sobre PGlite con el contrato local de Auth/Storage y la reconstrucción completa; cubre ambos payloads semanales, DST, saldos, comodines, aislamiento, permisos y transiciones de invitación. Prueba además handlers Edge con proveedor simulado, paginación, servicios y formulario real en Happy DOM. No equivale a validar SMTP, Auth, RLS de producción, conexiones simultáneas ni navegación visual móvil/tablet/escritorio.

Comandos: doce archivos Vitest de esta entrega/regresiones, ESLint de archivos JS/JSX modificados, `npm run build` del panel y `npm run check:functions` de raíz. Resultados finales registrados en `Features.md`. Los fallos globales previos de tests (plantillas de correo/fixture de módulos) y lint (`SeoFields.jsx`) no se dan por resueltos. El aviso de chunks grandes corresponde al hallazgo 22 excluido.
