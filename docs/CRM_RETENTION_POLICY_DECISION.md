# Decisiones pendientes · retención CRM

Estado: **decisión confirmada el 28/10/2026: solo revisión manual**. No se implementarán purgas ni automatizaciones destructivas. Este documento describe el comportamiento técnico local; no recomienda plazos ni sustituye la política legal de conservación de la empresa.

## Qué hace hoy el panel

En **Privacidad y datos** (`/settings/privacy`) un administrador puede establecer umbrales de 1 a 3650 días o dejar cada valor vacío. Son umbrales para mostrar conteos de revisión, no plazos legales ni instrucciones de borrado. Guardarlos no ejecuta anonimización, borrado ni cron. Los conteos tienen accesos directos a la bandeja de coincidencias ambiguas y al buscador de contactos.

| Categoría | Qué cuenta actualmente el umbral | Qué ocurre hoy |
| --- | --- | --- |
| Solicitudes ambiguas | Filas de `lead` con `crm_match_state = 'review_required'`, por `created_at`. | Solo aparece un conteo orientativo. Se resuelven desde la bandeja de solicitudes; el umbral no elimina nada. No incluye cualquier solicitud sin contacto: cuenta únicamente las que requieren revisión manual por coincidencia ambigua. |
| Contactos inactivos | Contactos cuya última fecha entre creación, actividad CRM y vínculo de documento supera el umbral. Se excluyen contactos con seguimiento futuro. | Solo aparece un conteo. La ficha se puede revisar individualmente en Privacidad y datos. |
| Solicitudes y actividades de un contacto | El export incluye solicitudes y actividades; la anonimización elimina actividades y anonimiza las solicitudes vinculadas. | Acción individual, administrativa y con confirmación explícita. Se registra un recibo técnico sin PII para idempotencia/auditoría. |
| Presupuestos y facturas vinculados | Se incluyen en la exportación solo si se asociaron explícitamente al contacto. | La anonimización retira el vínculo, pero conserva los documentos emitidos. |
| Registro técnico de anonimización | Guarda compañía, request ID, recuentos, actor y fecha; no guarda el nombre/email del contacto. | No hay caducidad automática configurada para este registro. |
| Logs y copias de proveedores | No están gobernados por estos umbrales CRM. | Su retención depende de la configuración y contrato de cada proveedor; no está verificada desde este repositorio. |

## Decisión aplicada

El usuario eligió revisión manual para todas las categorías. Los umbrales opcionales por empresa sirven solo para mostrar conteos de casos que requieren atención; no son plazos legales ni activan borrado o anonimización. Toda anonimización seguirá siendo una acción individual, administrativa y confirmada.

| Categoría | Evento desde el que contar | Periodo aprobado | Acción al vencer | Excepciones/retención justificada | Quién aprueba |
| --- | --- | --- | --- | --- | --- |
| Solicitud sin resolver por coincidencia ambigua | Creación de la solicitud | Umbral opcional para conteo | Revisión manual, sin purga | La resolución/vinculación sigue en Contactos y pipeline | Usuario confirma modo manual |
| Contacto sin actividad | Última actividad considerada por la función existente | Umbral opcional para conteo | Revisión manual; anonimización individual confirmada | Seguimiento futuro excluido del conteo | Usuario confirma modo manual |
| Solicitud vinculada a contacto | No aplica a purga automática | No configurado | Gestión individual de privacidad | Se conserva registro operativo anonimizado | Usuario confirma modo manual |
| Actividades CRM | No aplica a purga automática | No configurado | Se eliminan solo al anonimizar expresamente el contacto | Incluidas en exportación previa | Usuario confirma modo manual |
| Auditoría técnica sin PII | No aplica a purga automática | No configurado | Sin purga automática | Trazabilidad/idempotencia existente | Usuario confirma modo manual |
| Facturas y presupuestos | Fuera de la purga CRM | No definido aquí | Se conservan y se retira solo el vínculo con el contacto | Política documental separada | Fuera de este circuito |

Los responsables de la empresa pueden documentar su política legal de conservación por separado. Si en el futuro solicitan automatizar alguna purga, hará falta una decisión nueva y explícita por categoría antes de diseñar o habilitarla.

## Paso técnico posterior a la decisión

La decisión actual no requiere migración ni cron: el panel ya opera en revisión manual. Si en el futuro se aprobara una purga automática, usar una **migración nueva**, dry run por tenant, exclusiones explícitas, idempotencia, auditoría minimizada, pruebas de permisos entre empresas y aprobación separada antes de programar el cron. Las migraciones existentes no se reescriben.
