# Instalación reproducible de la aplicación · entrega 17

Corrige el hallazgo 15: el esquema base no creaba `client_company`, `planning_task`, `billing`, `attached_file` ni `client_company_members`; el orden narrativo mezclaba instalación y activación de servicios. Corrección local: no se ha ejecutado sobre Supabase remoto.

## Alcance y requisitos

El destino es un proyecto Supabase nuevo con PostgreSQL 15+, roles `anon`, `authenticated`, `service_role`, `auth.users`, `auth.uid()`, `auth.jwt()`, `storage.buckets` y `storage.objects` ya proporcionados por la plataforma. El usuario de conexión debe poder crear objetos, conceder permisos y ajustar los privilegios por defecto de los objetos que crea. Mantener el mismo propietario durante toda la aplicación.

La inicialización rechaza tablas, vistas, secuencias, funciones y tipos de aplicación existentes en `public` (las funciones/tipos pertenecientes a extensiones de plataforma no se consideran aplicación). No es un reconciliador de esquemas ni un procedimiento para reparar producción. Una base parcialmente instalada tampoco se reinicia ni se borra automáticamente.

## Generar y revisar

Desde la raíz:

```powershell
npm run db:bootstrap
```

Genera `database/local/bootstrap.generated.sql`, ignorado por Git. No abre conexiones ni lee `.env` o credenciales. Si el archivo ya existe, rechaza sobrescribirlo; para una nueva revisión usar otra ruta, por ejemplo:

```powershell
npm run db:bootstrap -- database/local/bootstrap-revision.sql
```

La secuencia está en `database/bootstrap/manifest.json`. Cada archivo de migración debe estar incluido o excluido con un motivo. El generador rechaza duplicados, rutas ajenas a las carpetas permitidas, snapshots de referencia, operaciones de scheduler y marcadores inexistentes o ambiguos. El SQL generado lleva nombre de cada fuente y su SHA-256; conservar el artefacto y la revisión Git usados para el entorno.

Las selecciones están declaradas explícitamente: analítica aporta funciones sin `CREATE EXTENSION` ni cron; recordatorios de Planning solo aportan la Parte A; el límite de leads omite su programación opcional de purga conservando el resto de la transacción. Los archivos originales permanecen intactos.

## Aplicar en un entorno descartable

Configurar una conexión libpq local llamada `regiamare-bootstrap`, con proyecto de destino y TLS verificado. Guardar la autenticación en el mecanismo local de credenciales de libpq, fuera del repositorio y de la línea de comandos. Comprobar identidad y estado del destino antes de ejecutar:

```powershell
psql 'service=regiamare-bootstrap' -X --set ON_ERROR_STOP=on --file database/local/bootstrap.generated.sql
```

El archivo activa también `ON_ERROR_STOP`: el primer error interrumpe la instalación. Respeta los bloques transaccionales originales; la secuencia completa no promete rollback global. Ante un error, conservar el diagnóstico y corregir la causa; reconstruir un entorno descartable nuevo para demostrar una aplicación limpia. No saltar pasos ni repetir la instalación completa sobre una base existente.

El bootstrap crea las tablas históricas desde DDL revisado, no ejecutando `BDD_REFERENCIA.sql`. Crea los buckets `items-media` y `blog-media` públicos, según el contrato de URLs de media, y `media-planner` privado. No carga archivos ni usuarios/clientes/documentos de demostración. Las dos tablas históricas auxiliares quedan cerradas al navegador hasta definir un flujo explícito para ellas.

Crear el primer usuario mediante los canales administrativos de Auth y asignar el claim de plataforma `app_metadata.app_role = admin` desde un canal de servidor autorizado; `user_metadata` no concede ese permiso. A continuación, usar los flujos administrativos de la aplicación para dar de alta la empresa y sus miembros. El bootstrap no crea una contraseña ni una cuenta privilegiada predeterminada.

Se revocan CREATE de navegador en `public` y grants automáticos de tablas para los objetos que cree la conexión. Las migraciones y el cierre aportan los grants necesarios; la lectura/escritura siguen sujetas a RLS. Se mantienen privadas las colas y los helpers, las facturas emitidas no admiten escritura directa y TRUNCATE no se concede al navegador. Verificar esos defaults también para otros propietarios que puedan crear tablas en el futuro.

## Activación posterior

Antes de producción: contrastar grants/RLS y versiones de funciones en un Supabase real, probar Storage/API/Auth, desplegar las Edge y configurar sus secretos. Los tests locales no arrancan servicios Supabase.

- Planning: desplegar `send-planning-reminders`, configurar sus secretos/Vault y revisar solo la Parte B de `PLANNING_REMINDERS.sql`.
- Facturas, resumen semanal y limpieza de items: desplegar sus workers y después aplicar sus archivos `*_CRON.sql`, según sus documentos de operación.
- Analítica: habilitar `pg_cron` según el entorno y activar únicamente la sección 4 de `ANALYTICS_AGGREGATION.sql`. No reaplicar los cuerpos antiguos de funciones sobre los parches de seguridad posteriores. El usuario de cron debe conservar la ejecución de agregación y purga.
- Límites de leads: si se desea purga periódica, configurar explícitamente `cron.schedule('purge-public-lead-rate-buckets','17 * * * *','select public.purge_public_lead_rate_buckets()')` con un ejecutor autorizado. La reserva ya elimina los buckets expirados de su empresa; el bootstrap no activa ningún job.
- Watch y mantenimiento: requieren su autorización y alcance propios. No están incluidos los demos, envíos de prueba ni reparaciones de zona horaria con marcadores de fecha.

En bases existentes, usar el historial real de despliegue, comparar definiciones/grants y aplicar solamente migraciones pendientes. El bootstrap no registra ni sustituye automáticamente el historial de Supabase CLI.

## Evidencia

24 pruebas en tres archivos. Las pruebas crean únicamente un contrato simulado de plataforma en PGlite y aplican la cadena completa, sin tablas ni helpers de aplicación fabricados por el fixture. Después comprueban emisión/saldos, denegaciones entre empresas y roles, aislamiento de preferencias, privacidad de borradores/media, grants de analítica, directorio compartido, movimientos de Planning y archivos privados. El payload semanal se ejecuta con `auth.users.email` de tipo varchar y sin instalar Watch.

El generador se prueba contra SQL operativo, migraciones sin clasificar, rutas no permitidas, duplicados, marcadores rotos y sobrescritura. Sigue pendiente verificar el despliegue real de Auth/REST/Storage, las extensiones, cron y concurrencia. No se han modificado migraciones anteriores ni ejecutado reparaciones de datos en esta entrega.


## Ampliación de auditoría 18–21

El manifiesto incluye ahora 68 pasos: añade las migraciones de métricas semanales, búsqueda literal de privacidad y estado de invitaciones antes de los grants finales. Sigue excluyendo cron y Watch. La reconstrucción local prueba también el contrato Auth `email_confirmed_at`; no sustituye la validación en Supabase real. Despliegue incremental y Edge/panel en `docs/auditoria-cierre-18-21.md`.
