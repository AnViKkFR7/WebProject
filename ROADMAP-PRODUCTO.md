# Roadmap de producto · Admin Regiamare

Plan para las diez capacidades solicitadas. Es una planificación de trabajo local, no indica que las funciones estén desplegadas. Las migraciones nuevas se aplicarán por separado y solo con verificación y autorización de despliegue.

## Punto de reanudación · 28/10/2026

1. **Aprobación de presupuestos (#2):** el usuario confirmó desplegadas `send-quote-approval-link` y `notify-quote-approval-response`, y probó aceptación/rechazo y correos de extremo a extremo. Las respuestas recientes del dashboard ahora se pueden plegar y marcar como tratadas por usuario; falta aplicar `BILLING_QUOTE_APPROVAL_DASHBOARD_HANDLING.sql` antes de desplegar esta mejora del panel.
2. **Avisos de vencimiento (#3):** el usuario confirmó desplegada `send-billing-due-reminders`; falta la prueba de envío real y el usuario informará el resultado.
3. **Accesibilidad/responsive (#4), validado por el usuario:** revisión visual autenticada de Contactos/pipeline, listado y editor de presupuestos, y facturación/avisos a 375/768/1024/1280 px. Solo se usó `WatchEcommerceDemo`. Se corrigió el quiebre de números/clientes en tablas estrechas, los controles del encabezado móvil son de 44 px y el CRM recibió un estado inicial guiado, métricas compactas y filtros unificados. No hay scroll horizontal del documento; el kanban y las tablas se desplazan dentro de sus regiones accesibles. El usuario aprobó el rediseño de Contactos y pidió continuar.
4. **CRM (#5), integración de código local lista para revisar:** el usuario confirmó que ejecutó `CRM_LEAD_ITEM_ATTRIBUTION.sql`. Se conectaron los formularios de los dos sitios MoiraOrdo al CRM, manteniendo su notificación actual, y se corrigió en Navagli el mapeo UTM/consentimiento a columnas CRM. Pruebas simuladas y builds pasan. No se desplegó ni se enviaron formularios reales; la prueba real pendiente debe usar únicamente `WatchEcommerceDemo`.
5. **Responsive tablet:** se corrigen los desbordamientos de cabecera, Seguimientos y métricas de Presupuestos con reglas basadas en el ancho útil del panel. En el navegador autenticado se verificó Contactos y Presupuestos a 768 px, con la empresa `WatchEcommerceDemo`; falta validación visual del usuario y revisión en los otros anchos.
6. **Guía de nuevos proyectos:** creada `company-site-snippet/MoiraOrdoCRMStartingDocument.md` con los contratos y límites comprobados. Mantenerla alineada con las guías específicas y migraciones.
7. **SEO público de items (punto #6 del backlog):** el panel y `CONTENT_SEO_FIELDS.sql` ya contienen los metadatos. Contrato técnico: `company-site-snippet/ITEMS_SEO_INTEGRATION.md`; migración gradual por sitio SPA, prompt para su chat de IA, preflight de solo lectura y SQL de lote: `company-site-snippet/ITEMS_SEO_MIGRATION_ROADMAP.md`, `database/maintenance/ITEMS_SEO_PREFLIGHT.sql` y `database/templates/ITEMS_SEO_VALUES_TEMPLATE.sql`. `moira_ordo` (legacy) y `moiraOrdoNew` no usan items dinámicos; Navagli ya consume `items`, pero aún no usa SEO por slug, HTML inicial ni sitemap de items. No cambiar rutas ni datos sin validación.

**Alcance obligatorio de pruebas con datos de empresa:** probar exclusivamente en la empresa `WatchEcommerceDemo`. No cambiar a otras empresas ni usar sus datos en pruebas visuales o funcionales.

No ejecutar SQL adicional para estos dos circuitos si los objetos ya están aplicados. Si se comprueba que falta un archivo, seguir el orden de `database/README.md` y anotar cuál se ejecutó.

## Fase 1 · Blog y SEO (MVP)

- [x] Convertir Blog en gestor con estados borrador/publicado/archivado, búsqueda, edición y aislamiento por empresa; conservar permisos existentes.
- [x] Añadir slug, metadatos SEO y fecha de primera publicación para items y posts.
- [x] Crear contrato Markdown para que los sitios clientes implementen `/blog`, `/blog/:slug` y metadatos públicos.
- [x] Añadir preflight SQL de solo lectura para posts publicados sin slug y colisiones antes de activar rutas públicas.
- [x] El usuario confirma que aplicó `CONTENT_SEO_FIELDS.sql`; el preflight remoto devolvió «Success. No rows returned» (sin posts publicados con slug inválido ni duplicados). RLS no fue comprobada independientemente.
- [ ] Integrar y revisar rutas públicas/prerenderizado en cada proyecto cliente. **Aplazado por el usuario: tratar Blog como feature aparte.**

### Verificación secuencial · 1. Blog · 26/10/2026

- **Panel local:** confirmado el dashboard con borradores/publicados/archivados, búsqueda y edición; los campos SEO incluyen slug, title, description e imagen OG. El preview es un snippet de búsqueda Google. Contrato de integración disponible en `company-site-snippet/BLOG_INTEGRATION.md`.
- **Evidencia local:** `CONTENT_SEO_FIELDS.sql` y preflight de slugs probados con PGlite; 7 pruebas dirigidas pasan. `database/local/DatabaseSQL.sql` contiene las columnas SEO, pero no contiene las restricciones, índices únicos ni trigger de `published_at` de la migración; no demuestra por sí solo que la migración completa esté aplicada.
- **Supabase:** migración confirmada por el usuario; preflight remoto sin filas. La auditoría no demuestra por sí sola que las políticas RLS remotas estén correctas.
- **Webs cliente:** en este repositorio no hay proyectos de webs cliente integrados, solo el contrato/snippet; no se ha verificado `/blog`, `/blog/:slug`, HTML inicial, OG/canonical ni sitemap en producción. La captura de `admin.moir.../blog` señala filtros de estado con ancho fijo de 40 px y un texto auxiliar visible porque faltaba la utilidad `.sr-only`; ambos se corrigen localmente, pero todavía no están desplegados a Vercel.
- **Para cerrar el punto:** revisar las políticas RLS del esquema remoto, desplegar el panel con la corrección visual y revisar la integración del contrato en cada sitio cliente.

## Fase 2 · Contactos y pipeline CRM (MVP prioritario)

- [x] Unificar contactos y actividad: formulario/notas/email/llamadas/visitas, facturas y presupuestos aparecen ordenados en un timeline; la revisión manual conserva allí el mensaje original de la solicitud.
- [x] Mostrar en la ficha y revisión manual toda la atribución disponible: ruta/página, referrer, campaña y UTM source/medium/term/content.
- [x] Añadir `source_item` opcional para identificar el item público que originó la solicitud; sincronizarlo también al resolver coincidencias manuales y borrarlo al anonimizar. El usuario confirmó que ejecutó `CRM_LEAD_ITEM_ATTRIBUTION.sql` en Supabase (28/10/2026); no se verificó la base remota independientemente.
- [x] Mostrar `source_item` también en la bandeja de solicitudes con coincidencia ambigua; la consulta de Supabase ahora incluye el campo y tiene regresión en `services/crmService.test.js`.
- [x] Vincular solicitudes entrantes por email/teléfono, aislado por empresa; asignar responsable y guardar ruta, referrer, UTM y campaña.
- [x] Pipeline kanban por empresa con etapas iniciales Nuevo → Contactado → Visita → Oferta → Cerrado/Perdido; renombrar, reordenar, crear y archivar etapas vacías.
- [x] Deduplicación segura. Email/teléfono con contactos diferentes requiere resolución manual explícita; no se fusionan registros.
- [x] Migraciones aditivas, RLS y pruebas PGlite negativas entre empresas/roles; el backfill crea/enlaza contactos y mantiene cada lead original.
- [ ] Configurar variables Vercel y desplegar los tres sitios; después probar un envío ficticio solo con `WatchEcommerceDemo`, verificando que se crea/vincula el contacto y llega la atribución. No enviar emails reales. La migración `CRM_LEAD_ITEM_ATTRIBUTION.sql` está confirmada por el usuario.

### Verificación secuencial · 5. CRM y formularios cliente · 28/10/2026

- **Contrato local:** `company-site-snippet/api/lead.ts` fija el tenant a `VITE_COMPANY_ID`, falla cerrado si falta la configuración del módulo CRM, guarda consentimiento solo junto a su versión, y conserva ruta, referrer, item y UTM. La API no acepta un `crm_contact_id` del navegador; el enlace/creación del contacto lo decide el trigger del servidor.
- **Pruebas locales:** `api/lead.test.ts`, `crmContactsPipeline.test.js` y `crmService.test.js`: 20 pruebas correctas. Usan datos sintéticos/locales, no filas de una empresa real.
- **Implementación local:** los dos formularios de MoiraOrdo ahora guardan primero en el CRM y después conservan su aviso existente. Navagli ya tenía integración y control de tenant/módulo; se corrigieron los nombres UTM que enviaba a columnas inexistentes y se añadieron fecha/origen del consentimiento.
- **Pruebas locales:** 7 pruebas simuladas de los tres endpoints pasan; lint focalizado de las APIs modificadas y los bundles Vite de los tres sitios pasan. No se usaron datos de empresa ni se enviaron emails. El lint global de `moira_ordo` y `Navagli` sigue reportando errores preexistentes en `CookieBanner.jsx`, `LanguageContext.jsx`, `Header.jsx` y dos páginas informativas; no se modificaron esos archivos.
- **Configuración pendiente:** cada despliegue Vercel debe tener `VITE_COMPANY_ID` de su tenant y los secretos de servidor `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. No se leyeron `.env` ni se configuraron variables.
- **Estado remoto:** el usuario confirma que ejecutó `database/migrations/CRM_LEAD_ITEM_ATTRIBUTION.sql` en Supabase (28/10/2026). No se consultó ni modificó la base remota; el estado se registra como confirmación del usuario, no como verificación independiente.
- **Límite de esta entrega:** los tres proyectos cliente están fuera del workspace editable actual. No se cambiaron archivos fuera del proyecto, no se mandaron emails y no se hicieron envíos de prueba.
- **Para cerrar el punto:** configurar variables por proyecto, desplegar los sitios y comprobar el formulario usando solo `WatchEcommerceDemo`; el test de datos deberá usar datos ficticios y no enviar emails reales. El punto queda detenido para validación del usuario.

### Verificación secuencial · 6. Contenido y SEO para items · 28/10/2026

- **Admin/BD:** el editor de items ya expone slug, título SEO, descripción y URL OG; `CONTENT_SEO_FIELDS.sql` define validación y slug único por empresa. El usuario confirma haber ejecutado la migración en Supabase; el estado remoto no se volvió a consultar.
- **Contrato público añadido:** `company-site-snippet/ITEMS_SEO_INTEGRATION.md` define consultas por tenant y estado, lectura segura de medios, campos/fallbacks, HTML inicial indexable, canonical, sitemap, caché, slugs y comprobaciones negativas. Blog continúa aplazado y separado.
- **Auditoría de webs conocidas:** `moira_ordo` es legacy y `moiraOrdoNew` el sitio vigente; ambos tienen contenido estático/local y no usan Items. **Navagli sí lee `public.items`**, filtrando por `company_id` y `item_type='proyecto-reforma-navagli'`, además de sus atributos y medios.
- **Siguiente trabajo de SEO para Navagli:** usar el `slug` y los campos SEO existentes, pasar detalle de UUID a slug con redirección de compatibilidad, añadir respuesta HTML server-side para crawlers y meter los items publicados en el sitemap. Antes, revisar/fijar SEO de sus items y comprobar slugs; no requiere migrar filas a otra tabla. No se han cambiado sus rutas ni se ejecutó SQL remoto.

## Fase 3 · Privacidad del CRM (MVP coordinado con CRM)

- [x] Guardar consentimiento y contexto de recogida junto al lead, sin inventar base jurídica ni plazos de conservación.
- [x] Exportación JSON y anonimización explícita de datos CRM por contacto, con resumen del alcance, permiso de administrador e idempotencia.
- [x] Proteger registros de facturación e historial que no deban borrarse como efecto lateral de borrar un contacto.
- [x] Configurar por empresa plazos para revisar solicitudes sin vincular y contactos inactivos, con conteos orientativos sin borrado automático.
- [ ] El responsable del tratamiento debe fijar los plazos y criterios aplicables; no se automatizan purgas sin esa decisión y revisión legal/operativa.
- [x] Conectar facturas/presupuestos a contactos para que el historial/exportación pueda incluirlos; la anonimización elimina el vínculo y preserva los documentos emitidos.

## Fase 4 · Operaciones de facturación y comunicación (MVP)

- [x] Aprobación/rechazo de presupuestos por enlace protegido, de un solo uso y con expiración, fecha, identidad declarada del cliente y traza inmutable.
- [x] El usuario ejecutó `BILLING_QUOTE_APPROVAL_PREFLIGHT.sql` en Supabase; las comprobaciones originales de tablas, índices, trigger, RPC, RLS y permisos devolvieron `true`.
- [x] Revisar la re-aprobación de una cotización corregida tras rechazo: `BILLING_QUOTE_APPROVAL_REVISIONS.sql` conserva las respuestas por enlace y actualiza el estado/versionado del presupuesto; histórico visible en el panel.
- [x] Añadir actualización automática del panel de presupuesto, aviso de respuestas recientes en el dashboard y envío del resultado a administradores activos con enlace directo al documento.
- [x] Permitir generar enlace y enviarlo al email guardado del cliente. `ADMIN_APP_URL` configurado por el usuario en secretos de Edge.
- [x] El usuario ejecutó el preflight actualizado `maintenance/BILLING_QUOTE_APPROVAL_PREFLIGHT.sql` y confirma todos los indicadores en `true`. `npm run check:functions` local compila ambas funciones (13/13 Edge Functions del repositorio).
- [x] El usuario confirmó el despliegue de `send-quote-approval-link` y `notify-quote-approval-response`, y probó aceptación/rechazo y correos de punta a punta.
- [x] Avisos de vencimiento configurables localmente: offsets, hora de Madrid, baja por factura, deduplicación, reintentos/idempotencia, panel de fallos y purga.
- [x] El usuario autorizó enviar a Resend solo email, número, vencimiento y saldo; la cola no persiste esos datos y el emisor los relee tras comprobar pago, baja y módulo.
- [x] El usuario confirmó la ejecución de `migrations/BILLING_DUE_REMINDERS.sql` y `migrations/BILLING_DUE_REMINDERS_CRON.sql`, tras configurar ambos secretos Vault.
- [x] El usuario confirmó el despliegue de `send-billing-due-reminders`; queda pendiente la prueba real de envío/cancelación/idempotencia y el usuario comunicará el resultado.
- [x] Resumen semanal agregado automático por email a administradores activos: lunes 09:00 Madrid, sin pestaña, módulos respetados, cola semanal, idempotencia y purga.
- [x] El usuario confirma que aplicó `WEEKLY_SUMMARY_EMAIL.sql`, `WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql` y `WEEKLY_SUMMARY_EMAIL_CRON.sql`, configuró secretos y desplegó `send-weekly-summary`; falta comprobar una entrega real controlada.
- [x] Documentar destinatarios, datos enviados, retención e idempotencia en `docs/emails.md`.

### Verificación secuencial · 2. Aprobación de presupuestos · 26/10/2026

- **Código local:** emisión solo para presupuestos enviados; token aleatorio de 256 bits, hash SHA-256 guardado en BD y token en fragmento URL; enlace inicial de 30 días; reemisión revoca el anterior; cambios del documento o estado lo invalidan. La respuesta aceptada/rechazada registra fecha, nombre/email declarados y motivo opcional; la decisión es de un solo uso y aparece en el historial.
- **Frontend:** `/quotes/respond` es público y `admin-panel/vercel.json` ofrece fallback SPA. El panel genera/copia enlaces o envía al cliente el correo guardado; el bloque de respuesta resalta decisión/estado, conserva el historial y refresca mientras el documento está abierto. El dashboard lista las cinco respuestas más recientes de los últimos 90 días con vínculo directo al presupuesto. La pantalla aclara que la identidad se declara, no se verifica legalmente.
- **Lógica SQL:** la primera versión admitía una respuesta única por presupuesto y dejaba obsoleta la decisión tras una revisión. `BILLING_QUOTE_APPROVAL_REVISIONS.sql` elimina esa unicidad por presupuesto, mantiene una respuesta inmutable por enlace y devuelve la respuesta más reciente. Un presupuesto revisado debe volver a enviarse antes de crear otro enlace.
- **Emails:** se añadieron `send-quote-approval-link` y `notify-quote-approval-response`; el primero envía el enlace al cliente, el segundo informa a administradores activos con ruta al documento. `ADMIN_APP_URL` confirmado en secretos por el usuario. Los datos y destinos están documentados en `docs/emails.md`.
- **Supabase:** el usuario confirma que ejecutó el SQL de revisiones y el preflight actualizado; todas las comprobaciones devolvieron `true`, incluidas las columnas de envío/aviso y los permisos de las RPC.
- **Cierre remoto confirmado por el usuario (28/10/2026):** `send-quote-approval-link` y `notify-quote-approval-response` están desplegadas; acepta/rechaza presupuestos y confirma emails de extremo a extremo. La revisión visual sigue su propia fase transversal.

## Fase 5 · Módulos por empresa y búsqueda global (MVP)

- [x] Catálogo central de módulos con todos activados al crear empresa; solo el administrador del sistema puede ver y cambiar su configuración.
- [x] Aplicar configuración a navegación y rutas, además de RLS y barreras de escritura para RPC. La UI no sustituye autorización de servidor.
- [x] El usuario confirmó que ejecutó los dos scripts de Company en Supabase, incluida la configuración de módulos solo para el administrador del sistema.
- [x] Búsqueda Ctrl+K de items, contactos, facturas y presupuestos, limitada a empresa/módulos accesibles; navegación por teclado y estados de carga/vacío/error.

## Fase 6 · Marca y edición de emails para clientes (MVP)

- [x] Añadir el apartado central «Emails» dentro de la configuración de empresa. La identidad se configura una vez y se aplica a todos los emails al cliente; no hay cambios por presupuesto, factura o envío individual.
- [x] Ofrecer dos diseños (clásico y marca destacada), logo de la empresa, paleta con muestras y controles de contraste. Aplicar el mismo logo/paleta a todas las plantillas de cliente.
- [x] Incluir una previsualización aislada con datos ficticios, vistas escritorio/móvil e idioma ES/EN, sin enviar emails.
- [x] Mostrar el logo seleccionado en la previsualización con una fuente local de datos, manteniendo CID en los emails reales; añadir selección de paletas guardadas de la empresa.
- [x] Ubicar el logo junto al aviso y nombre del remitente en ambos diseños; mantenerlo a escala compacta y evitar un bloque de logo aislado bajo el encabezado.
- [x] Hacer claramente distintos los diseños clásico y marca destacada; evitar que el nombre aparezca repetido en la cabecera/contenido predeterminado y enlazar el pie MoiraOrdo a su web.
- [x] Presentar las acciones de email como CTA con estilo de botón. Los enlaces de navegación deben seguir siendo `<a href>` para compatibilidad con clientes de correo; no usar elementos HTML `<button>` en el email.
- [x] Permitir editar asunto, preencabezado y HTML por tipo de email. Se muestran variables disponibles; el renderizador limita/sanitiza HTML y enlaces, crea versión texto y usa fallback predefinido si la plantilla guardada no puede renderizarse.
- [x] Configurar el idioma predeterminado de envío por empresa (ES/EN), usado tanto por presupuestos como por recordatorios automáticos. El idioma de edición/previsualización permite seguir modificando ambas traducciones.
- [x] Guardar hasta diez revisiones por empresa con autor/fecha y ofrecer restaurar una versión anterior; la restauración genera una nueva revisión.
- [ ] Mantener contratos de email accesibles y compatibles en los clientes principales: HTML usa estilos inline y no carga fuentes externas ni JavaScript. Revisar tablas/layout, orden de lectura, textos alternativos y modo oscuro real.
- [x] Catálogo inicial de emails existentes al cliente: enlace de aprobación de presupuesto y aviso de vencimiento de factura. No incluye emails internos de dashboard, Planning o resumen semanal.
- [x] Añadir bloque superior «Este mensaje te lo envía {empresa}» con contraste AA y pie «Recurso digital powered by MoiraOrdo». Mantener el remitente técnico verificado de MoiraOrdo, sin falsificar remitentes.
- [ ] Definir si se quiere un pie legal común y qué datos mostrar. El registro `companies` tiene email, teléfono y web, pero NIF/dirección fiscal solo existen en la copia del emisor por documento; el renderer actual no los recibe. No inyectar esos datos en Resend sin decisión explícita sobre contenido y alcance.
- [x] Guardar configuración/HTML por empresa mediante tabla privada y RPC con verificación de rol en servidor; acceso directo de usuarios revocado.
- [x] Resolver placeholders escapados sin ampliar los datos que se envían a Resend; se mantiene la idempotencia existente.
- [x] Añadir migración aditiva, preflight de solo lectura, secuencia SQL, documentación y renderizador común a las funciones Edge. Casos unitarios de sanitización, idioma, texto, logo y layout.
- [ ] Ejecutar la migración y preflight en Supabase; desplegar frontend/Edge y verificar envío controlado e idempotencia de extremo a extremo.
- [ ] Aplicar migración/preflight en Supabase y desplegar; validar Gmail, Outlook, Apple Mail y 375/768/1024/1280 px con capturas reales y accesibilidad.

### Alcance de emails confirmado por código

- Actualmente se envían a clientes los enlaces de aprobación de presupuesto y los recordatorios de vencimiento. El email de factura emitida todavía no existe y queda fuera del MVP; se añadirá al catálogo cuando se implemente ese envío.
- El aviso de aceptación/rechazo del presupuesto, avisos de Planning y resumen semanal son comunicaciones internas. Mantienen su diseño técnico y quedan fuera del editor inicial.
- Cada tipo conserva su HTML editable por separado en la pestaña central; logo, paleta, bloque de origen y pie de MoiraOrdo son comunes a todas las plantillas.

El estado local de implementación y los pasos de activación están en `docs/emails.md`. Las migraciones y funciones Edge todavía no se han desplegado.

## Fase transversal · Accesibilidad, móvil y fiabilidad (continua)

- [ ] Revisión visual autenticada lista para validación a 375/768/1024/1280 px en Contactos/pipeline, listado/editor de presupuestos y facturación/avisos. `WatchEcommerceDemo` fue el único tenant usado. Se corrigió el quiebre de números/clientes en tablas estrechas, se ampliaron a 44 px los objetivos del menú, búsqueda y perfil, y se rediseñó el estado vacío y la jerarquía del CRM. No se detectó desbordamiento del documento en las capturas; las regiones de kanban/tablas conservan su scroll horizontal, con nombre accesible y foco de teclado. Detener aquí para que el usuario valide antes del punto #5.
- [ ] Computer Use en Windows detuvo la captura al no poder determinar con confianza la URL activa; no se obtuvo evidencia visual y no se interactuó con la página.
- [x] Corregida la regla móvil global que ocultaba encabezados y convertía todas las tablas nativas en tarjetas: ahora solo afecta a la lista div-based de Items. Facturación, profundidad de scroll y alta masiva conservan tablas semánticas; sus regiones con scroll horizontal tienen nombre accesible y foco de teclado. Regresión en `tests/accessibility/mobileSemanticTables.test.js`.
- [x] Contraste de tokens comunes de texto, estado y límites de controles comprobado con umbrales WCAG AA; los temas claro/oscuro pasan la prueba `tests/accessibility/colorTokens.test.js`. Los botones del panel reciben tooltip derivado de texto visible, etiqueta accesible o `<label>` asociado. La auditoría AST detectó y corrigió los botones solo-icono sin nombre de acciones de usuario y contraseña, con etiquetas ES/EN; los botones decorativos del calendario quedan fuera del árbol accesible.
- [x] El color del foco de teclado se verifica a 3:1 o más contra las superficies del tema claro y oscuro; `tests/accessibility/colorTokens.test.js` lo comprueba junto a los contrastes de texto.
- [x] CRM: la ficha de contacto apila historial y datos hasta 850 px; el historial de documentos y la configuración de etapas pasan a filas adaptables en tablet y móvil, con objetivos táctiles de 44 px.
- [x] El kanban CRM con desplazamiento horizontal ahora se puede recorrer y anunciar como región mediante teclado/lector de pantalla; regresión incluida junto a las tablas horizontales.
- [x] Editor de facturas/presupuestos: el selector de modo tiene nombre accesible de grupo y se conserva el indicador de foco del encabezado.
- [x] Selector múltiple: el buscador interior conserva un indicador de foco de teclado visible al quitar el contorno nativo del input; el foco de enlaces extendidos se marca en su tarjeta.
- [x] Los campos globales y el input de edición de descripción de Items que anulaban `outline` en `:focus` recuperan un contorno explícito en `:focus-visible`; la regresión está en `tests/accessibility/focusIndicators.test.js`.
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
