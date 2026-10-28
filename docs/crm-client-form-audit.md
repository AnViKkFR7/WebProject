# Auditoría de formularios públicos para CRM · 26/10/2026

## Estado de seguimiento · 28/10/2026

El usuario confirma que ejecutó `database/migrations/CRM_LEAD_ITEM_ATTRIBUTION.sql` en Supabase; no se hizo una comprobación remota independiente. Se localizaron los proyectos `C:\development\webs-joselyn\moira_ordo`, `C:\development\webs-joselyn\moiraOrdoNew` y `C:\development\webs-joselyn\Navagli\Navagli`.

Se conectaron localmente los formularios de los dos sitios MoiraOrdo a `api/lead.js` y `src/lib/leads.js`; ambos guardan primero la solicitud en el CRM y conservan su aviso interno por email. Navagli ya tenía el endpoint y la llamada desde el formulario; se corrigió el mapeo UTM para escribir `source_utm_source`, `source_utm_medium`, `source_utm_term` y `source_utm_content`, y se completó `consent_at`/`consent_source`.

Pruebas simuladas de los endpoints: 7/7; builds cliente de los tres sitios y SSR de `moiraOrdoNew` correctos; ESLint focalizado correcto. El lint global falla en código preexistente de `moira_ordo` (`CookieBanner.jsx`, `LanguageContext.jsx`) y `Navagli` (`Header.jsx`, `AboutPage.jsx`, `AsesoramientoProfesionalPage.jsx`). Los artefactos de build se escribieron temporalmente y se eliminaron; no se sobrescribieron `dist` existentes.

No se desplegaron cambios ni se enviaron formularios o emails reales. Variables necesarias en cada proyecto Vercel: `VITE_COMPANY_ID` del tenant; `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` solo en servidor. No se leyeron `.env` ni se tocaron secretos. La prueba E2E pendiente debe hacerse solo con `WatchEcommerceDemo`, usando datos ficticios y sin enviar emails reales.

La tabla siguiente registra la situación observada en la auditoría inicial del 26/10. Se inspeccionaron formularios/endpoints; no se leyeron `.env`, credenciales ni datos de clientes.

## Situación observada en auditoría inicial · 26/10/2026

| Proyecto | Flujo actual | Brechas frente a `company-site-snippet/LEADS_INTEGRATION.md` |
|---|---|---|
| `moira_ordo` | `src/pages/Contacto.jsx` envía a la Edge Function `moira-ordo-contact-form`. | No llama a `/api/lead`; la casilla de privacidad es obligatoria en UI, pero no se incluye su consentimiento/versión en el payload; no se captura attribution UTM para CRM. |
| `moiraOrdoNew` | `src/pages/Contact/Contact.jsx` envía a la misma Edge Function y requiere una casilla de privacidad. | No crea una solicitud CRM; no envía consentimiento ni su versión; no transmite ruta, referrer ni UTM. |
| `Navagli` | `src/components/CTAForm/CTAForm.jsx` llama a `src/lib/leads.js`, que escribe mediante `api/lead.js`; después intenta enviar una notificación por `navagli-send-email`. | La API solo compara el `company_id` con `VITE_COMPANY_ID` si esa variable existe: si falta, acepta el tenant del cuerpo pese a usar `service_role`. No verifica el módulo CRM. El formulario exige casilla de privacidad pero no envía consentimiento/versionado; solo guarda ruta y `utm_campaign`, no referrer ni el resto de UTM. |

## Acción necesaria para cerrar la integración

1. En los dos sitios MoiraOrdo, conectar el formulario actual con el endpoint CRM manteniendo la notificación existente, registrar consentimiento con versión explícita y preservar la experiencia de éxito/error. Cuando el formulario nace desde una ficha de item, pasar también `source_item` (nombre/slug/ID público) con la nueva guía.
2. En Navagli, reemplazar la API por el contrato endurecido del snippet: tenant obligatorio fijado por variable del despliegue, comparación previa a cualquier consulta, verificación del módulo, consentimiento/versionado y todos los campos UTM. Si el formulario se abre desde un item, enviar `source_item`. Revisar si `navagli-send-email` debe seguir recibiendo el mismo mensaje tras confirmar que la solicitud CRM se guardó.
3. Ejecutar pruebas con datos ficticios por sitio y verificar que cada solicitud aparece solo en su empresa, con origen y consentimiento trazables. No usar correos reales sin su autorización específica.
4. Para modificar estos proyectos se necesita que estén en el workspace editable o habilitar acceso de escritura a esas carpetas. No desplegar sin revisar sus cambios locales y validar sus variables de Vercel.

No se debe marcar CRM/formularios cliente como completado mientras estos flujos no estén actualizados y comprobados. Este informe no valida el estado remoto de Supabase, Vercel ni Edge Functions.

## Actualización del contrato compartido · 26/10/2026

`company-site-snippet/api/lead.ts` ahora falla cerrado también cuando falta la fila `crm` en `company_modules`, y no acepta el formulario en ese estado. La prueba del endpoint confirma el 503 y que no se inserta el lead. Esto corrige el contrato nuevo; no cambia los endpoints que hoy usan los sitios hermanos, incluido `Navagli`, hasta que sustituyan/adopten el snippet. La prueba de API obtiene 9/9 casos correctos; no equivale a una prueba de integración en Vercel.

## Actualización de integración local · 28/10/2026

La afirmación del informe inicial de que los proyectos estaban fuera del workspace editable describía el bloqueo de aquella revisión. Después se localizaron las carpetas y se actualizaron **localmente** `moira_ordo`, `moiraOrdoNew` y `Navagli` con el contrato descrito arriba. No se desplegó a Vercel ni se validaron las variables de producción. Si esos son los repos que alimentan los despliegues, no hay que encargar a otro proyecto que vuelva a implementar el cambio; hay que revisar/sincronizar los cambios locales, configurar variables por tenant y desplegar tras validarlos. Si Producción usa otro clon, ese clon debe recibir los cambios equivalentes de `/api/lead`, helper `submitLead`, consentimiento/versionado, origen (incluido `source_item`), UTM y comprobación del módulo CRM.

La guía general viva para proyectos nuevos está en `company-site-snippet/MoiraOrdoCRMStartingDocument.md`. La única prueba con datos reales autorizada en esta tarea sigue siendo `WatchEcommerceDemo`; los tests locales de los sitios usaron mocks y datos sintéticos.
