# Revisión posterior a correcciones · 29/10/2026

## Dictamen y alcance

No procede declarar que todo está correcto. Se ejecutó la suite completa local y se revisaron adicionalmente los flujos de invitación, alta con contraseña, listado Auth y configuración de despliegue. Las regresiones existentes cubren SQL, aislamiento, saldos, recurrencias, Storage, módulos, servicios y UI. Esto no equivale a una nueva inspección manual exhaustiva de cada archivo ni a validar producción. Sin conector Supabase/Vercel disponible, no se contrastaron migraciones efectivas, grants, RLS, cron, secretos o versiones desplegadas. No se hicieron cambios funcionales ni remotos.

## Hallazgos

### Alto · El reintento puede conceder un rol anterior más permisivo

En database/migrations/COMPANY_USER_INVITATION_STATE.sql:31, el conflicto por empresa/correo conserva role/full_name antiguos. La actualización de claim tampoco los cambia. attach crea una membresía nueva con q.role (línea 58).

Reproducción SQL con esquema completo: primera solicitud editor; finalizar failed antes de crear membresía; transcurridos 60 segundos, solicitud viewer con resend=true; crear la cuenta y attach. Resultado: ready=true, role=editor. No es una elevación anónima: requiere una solicitud anterior autorizada, pero entrega escritura cuando el administrador está solicitando lectura. Conservar roles de membresías ya existentes no justifica conservar el rol de una membresía que aún no existe.

Evidencia ejecutable: admin-panel/tests/database/auditInvitationRole.repro.test.js. Esta prueba documenta el defecto actual, no el comportamiento deseado. Reparación propuesta: rechazar cambios de contexto de invitación o actualizar el contexto autorizado antes de crear una nueva membresía; mantener la protección de membresías existentes. Convertir después la reproducción en regresión que exija viewer.

### Medio · Alta con contraseña conserva una compensación no comprobada

supabase/functions/create-user/index.ts crea Auth antes de insertar company_members. Si falla la membresía llama a deleteUser, pero ignora su resultado. Si también falla el borrado, queda una cuenta confirmada sin la membresía prevista y la respuesta no indica recuperación; repetir el formulario encuentra un email ya existente. Revisado en código, sin provocar fallos en Auth real. La recuperación implementada en invite-user no cubre esta otra modalidad del mismo formulario.

Propuesta: validar empresa antes de crear y representar los resultados parciales de forma persistente; reconciliar de forma segura sin asumir que el borrado compensatorio tuvo éxito.

### Bajo · Verificación automatizada global pendiente

npm test: 124 archivos correctos y 2 fallidos; 749 pruebas correctas, 3 fallidas y 7 omitidas. companyModules.test.js falla en la preparación por una propiedad esperada ausente (email_revisions_table_exists). customerEmailTemplate.test.js falla en tres expectativas de background frente a background-color. Estos fallos no demuestran por sí solos una vulnerabilidad ni ausencia de colores, pero impiden acreditar la suite completa y dejan las siete pruebas del archivo de módulos sin ejecutar. Son fallos ya documentados previamente.

npm run lint: un error react-hooks/set-state-in-effect en src/components/seo/SeoFields.jsx:12, también previo. Revisar la lógica de reinicio de sugerencia; no silenciar globalmente la regla.

## Comprobaciones correctas

- Suite general: los 124 archivos restantes pasan, incluidas las regresiones de las correcciones previas. No se deduce de ello ausencia de casos no cubiertos.
- Reproducción adicional SQL: 1 prueba pasa, confirmando el defecto de rol descrito.
- npm run build: correcto; aviso de chunks grandes, hallazgo 22 excluido por el usuario.
- npm run check:functions: 14/14 funciones compilan; no prueba servicios externos ni configuración remota.

## Prioridad de cierre

1. Resolver contexto/rol de reintentos de invitación y añadir regresiones de cambio de rol/nombre sin membresía previa.
2. Extender recuperación al alta con contraseña y probar fallos combinados Auth/membresía/compensación.
3. Resolver los fallos globales de pruebas y lint conservando las comprobaciones de permisos.
4. Contrastar SQL/grants/RLS/Edge efectivos en Supabase y versión del panel en Vercel, con dos empresas, roles y buzones controlados. No se ha verificado todavía este estado remoto.
