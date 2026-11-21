# Correcciones de revisión posterior · 29/10/2026

## Cambios

- Nueva migración COMPANY_USER_PROVISIONING_RECOVERY.sql, posterior a COMPANY_USER_INVITATION_STATE.sql. Actualiza nombre/rol del contexto pendiente bajo bloqueo; attach sigue conservando membresías existentes. La reproducción del rol editor tras solicitar viewer se convierte en regresión que exige viewer.
- create-user usa las RPC privadas de claim/attach/finish para validar empresa y administrador antes de Auth y persistir intentos. No guarda contraseñas en SQL, no elimina cuentas como compensación y no cambia contraseñas existentes. Los errores de membresía/confirmación devuelven un resultado parcial recuperable. Reintentar el formulario después del intervalo de 60 segundos reutiliza la cuenta; un lease incierto vence en dos minutos.
- El formulario conserva entrada al fallar. Solo muestra la contraseña como nueva cuando Auth confirma su creación en esa petición. Si recupera/vincula una cuenta existente, vacía el campo y explica en ES/EN que debe usarse recuperación de contraseña si se desconocen las credenciales. También aplica a cuentas heredadas sin membresía, sin atribuirles la contraseña introducida.
- Pruebas de módulos conservan el preflight específico de revisiones de correo y comparan el contrato real del preflight de módulos. Pruebas de email verifican background-color en la cabecera, mantienen background en el botón y usan texto/importe acordes a la entrada española. No se eliminan las pruebas de permisos.
- SeoFields vincula la sugerencia a título/resumen y la oculta cuando no coincide, sin setState dentro de un efecto ni desactivar reglas ESLint.

## Despliegue

1. Aplicar database/migrations/COMPANY_USER_PROVISIONING_RECOVERY.sql sobre la migración anterior ya aplicada. No repetir AUDIT_18_21_APPLY.sql. La migración nueva reemplaza una función y conserva sus permisos privados.
2. Desplegar create-user y publicar el panel. invite-user utiliza la RPC corregida automáticamente; no necesita un cambio de código adicional para esta entrega.
3. Validar con usuarios controlados: primer intento editor fallido y reintento viewer; recuperación tras fallo de membresía; cuenta existente sin cambio de contraseña; rechazo a operador no administrador y membresía suspendida.

Bootstrap actualizado a 69 pasos. No se ha aplicado SQL, desplegado ni creado cuentas remotas. Resultado final de comprobaciones registrado en Features.md. El punto 22 continúa excluido.
