# Auditoría de módulos y RPC · entrega 6

## Entradas y controles

| Familia | Protección y decisión |
|---|---|
| Facturas, presupuestos, perfiles, borradores, paletas, cobros y restauración | assert_billing_access exige usuario, rol de escritura y módulo billing. Afecta también rutas idempotentes que devolvían datos antes de escribir. |
| get_invoice_financials | Control propio de roles incluye viewer; ahora exige billing sin alterar fórmula financiera. |
| list/retry de avisos de vencimiento y Planning | Conservan roles existentes; añaden módulo antes de lectura o reintento. |
| Privacidad y retención CRM | assert_crm_privacy_admin exige autenticación, empresa, administrador y módulo crm. Cubre búsqueda, previsualización, exportación, anonimización y revisión de retención. |
| Exportación CRM con documentos asociados | Con crm activo y billing desactivado conserva datos CRM; billing_documents vacío y billing_module_enabled=false indican exportación sin ese módulo. Activar billing para exportar también esos documentos. |
| Storage Planning | can_access_planner_object resuelve empresa canónica o legado y exige planning; también para platform admin. Se mantienen roles de lectura/escritura. Rutas de legado no acreditadas permanecen denegadas. |
| Movimientos Planning y escrituras de tablas | Los triggers de COMPANY_MODULES protegen escrituras privilegiadas. Entrega 15 sustituye solo el trigger de client_company para admitir Planning o Facturación. |
| Directorio de clientes | CLIENT_DIRECTORY_MODULE_ACCESS mantiene membresía activa para lectura y admin/editor para RPC; permite Planning o Facturación. Helpers privados y escritura directa revocada. Ver docs/directorio-clientes-compartido.md. |
| Aprobación pública de presupuestos | assert_quote_approval_module ya protege acceso y respuesta; COMPANY_MODULES_SCOPE_FIX cubre auditoría, notificaciones y plantillas. Se mantiene autorización por token. |
| Items y analítica | Entregas 2–4 cubren portada, vista y agregación manual. Las RPC internas de mantenimiento quedan restringidas a ejecutores técnicos. |
| Workers/colas y mantenimiento | Sus permisos de service_role y verificaciones de payload se conservan. Una reclamación/purga técnica de cola no es una lectura de negocio autorizada al navegador. |
| Membresías, configuración de módulos y preferencias generales | Son controles transversales de acceso/configuración, no se desactivan junto con un módulo de negocio. |

## Migración y pruebas

Aplicar COMPANY_MODULES_RPC_COMPLETION.sql después de COMPANY_MODULES_SCOPE_FIX y las definiciones finales de Facturación, CRM (incluidos privacidad, vínculos y retención), BILLING_DUE_REMINDERS, PLANNING_EMAIL_QUEUE y PLANNING_STORAGE_HARDENING. Requiere has_company_role/is_company_member actualizados por COMPANY_MEMBER_ACCESS. No volver a aplicar definiciones anteriores después. No crea aliases unchecked ni modifica ACL existentes de las funciones reemplazadas.

PGlite ejecuta la cadena real de facturación y funciones modificadas con tablas auxiliares mínimas para colas y CRM. Seis pruebas nuevas cubren bloqueos, permisos por empresa y autor, reactivación, almacenamiento legado/canónico y exportación por módulo. Regresión adicional: BILLING_DRAFTS y rectificativas (14 pruebas conjuntas). Las pruebas de funciones no sustituyen la inspección de políticas/grants Storage ni el historial remoto.

Pendiente: aplicación de migración y verificación de REST/RPC/Storage reales en entorno controlado con dos empresas. No hay cambios de frontend ni despliegue de Edge.
