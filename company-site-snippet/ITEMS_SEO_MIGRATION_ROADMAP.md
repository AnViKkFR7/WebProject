# Roadmap: activar SEO de items en webs SPA existentes

## Objetivo y alcance

Este plan migra webs públicas que ya consumen items de MoiraOrdo CRM y son SPA. La fila continúa en `public.items`: no se copia a otra tabla ni se transforma su modelo. La migración consiste en completar sus metadatos SEO, servir páginas indexables desde el servidor y mantener rutas, sitemap y navegación coherentes.

El esquema SEO se añadió mediante `database/migrations/CONTENT_SEO_FIELDS.sql` a `items` y `blog_posts`. El usuario ya confirmó que ejecutó esa migración. No la repitas: antes de empezar un proyecto, verifica las columnas con el preflight de ese proyecto o con el esquema remoto autorizado.

## Roadmap por proyecto

### Fase 0 — Inventario y alcance

- Identificar el `company_id`, `item_type`, rutas actuales, framework de despliegue y estrategia de sitemap del sitio.
- Confirmar que lista `items` filtrando siempre por `company_id`, `item_type` y `status='published'`.
- Inventariar rutas compartidas con UUID, enlaces externos, canonical, datos de atributos e imágenes de portada.
- No mezclar tipos de item: el índice de `slug` es único por `company_id` entre **todos** sus item types.
- Crear copia/exportación de las filas que se van a editar y no cambiar ningún dato funcional del item.

**Entregable:** inventario de rutas/filas y lista de riesgos, aprobado antes de generar metadatos.

### Fase 1 — Auditoría de datos y exportación

- Exportar únicamente los items publicados del tenant y tipo acordados: `id`, `company_id`, `item_type`, `title`, `summary`, `slug`, SEO actual, atributos públicos ya interpretados e imagen de portada.
- Usar el preflight SQL de la sección siguiente para detectar campos ausentes, slugs no válidos, duplicados y registros fuera del alcance.
- El export debe excluir datos privados, borradores, campos CRM, actividad y datos de clientes.
- La IA de cada proyecto trabaja con este export o con contenido público equivalente; no consulta tenants ajenos.

Ejecuta en modo lectura `database/maintenance/ITEMS_SEO_PREFLIGHT.sql` tras sustituir el tenant y tipo exactos. El resultado incluye contenido editorial necesario para preparar el export, campos incompletos y colisiones de slug por empresa.

**Entregable:** inventario de publicados y problemas de datos; sin escrituras aún.

### Fase 2 — Redacción SEO por item

La IA del proyecto genera una propuesta por fila, preservando el sentido del contenido:

- `slug`: descriptivo, estable, minúsculas ASCII y guiones; hasta 120 caracteres.
- `seo_title`: distintivo, fiel al item y hasta 70 caracteres. No añadir claims no presentes.
- `seo_description`: resumen útil, hasta 160 caracteres; no inventar precio, disponibilidad, ubicación, prestaciones ni fechas.
- `seo_og_image_url`: imagen pública HTTPS real, preferentemente portada existente. Si no hay imagen apta, `NULL`; nunca fabricar URL.
- Revisar manualmente colisiones y cambios de slugs existentes. Si una URL ya se compartió o indexó, conservarla o planificar redirect permanente.

**Entregable:** CSV/tabla `id, company_id, item_type, slug, seo_title, seo_description, seo_og_image_url`, aprobado por el responsable del sitio.

### Fase 3 — Escritura segura en Supabase

- Preparar una copia del SQL plantilla `database/templates/ITEMS_SEO_VALUES_TEMPLATE.sql` y sustituir la fila de ejemplo por propuestas revisadas.
- Ejecutarlo solo en el proyecto Supabase correcto, tras validar IDs, slugs y valores. El script vuelve a comprobar tenant, tipo, estado publicado y colisiones; actualiza exclusivamente los campos SEO y `updated_at`.
- Ejecutar primero en transacción y revisar el conjunto devuelto por el `SELECT` de verificación antes de confirmar.
- Guardar el lote aplicado y el resultado de comprobación en el registro de despliegue del proyecto.

**Entregable:** metadatos SEO cargados; no se altera título/resumen funcional, atributos, estado, precio ni imágenes originales.

### Fase 4 — Rutas estables y compatibilidad

- Resolver detalle usando `company_id + item_type + status + slug`; no confiar en el slug como frontera de tenant.
- Actualizar enlaces de tarjetas y navegación al slug.
- Mantener rutas antiguas por UUID. Resolver el UUID dentro del mismo tenant/tipo/estado y responder redirect permanente al slug si sigue publicado.
- Item no encontrado, draft o archived: 404 real y `noindex`; no usar datos mock como fallback de error en producción.
- No cambiar slugs ya publicados sin redirect permanente desde cada URL previa.

### Fase 5 — HTML inicial indexable para la SPA

Una actualización del `<head>` únicamente en React/useEffect no basta para previews sociales y rastreadores que no ejecutan JavaScript. Configurar SSR, prerender o una función server-side con HTML por slug. Incluir en la respuesta HTTP inicial:

- `<title>` y `meta description` con fallback `seo_title || title` y `seo_description || summary`.
- canonical absoluto; Open Graph title/description/url/image y Twitter card si el sitio ya usa esa integración.
- `robots=index,follow` solo para publicados válidos; `noindex`/404 para estados no públicos.
- Contenido principal equivalente al de la página React, con escape de atributos y metadatos.

Usar acceso público/anon para leer publicados. No exponer service-role en el cliente ni convertir la función en lector de borradores.

### Fase 6 — Sitemap, caché e imágenes

- Añadir al sitemap solo items publicados con slug válido y URL canónica del dominio HTTPS del sitio.
- Usar `updated_at` como `lastmod` solo si se corresponde con cambios editoriales útiles; no incluir query strings ni URLs UUID.
- Al publicar, editar, archivar o cambiar slug, revalidar HTML, canonical, ruta antigua/nueva y sitemap.
- OG/portada debe ser HTTPS, pública, accesible sin cookies y conservar proporción; incluir alt text de la imagen en el contenido.

### Fase 7 — Verificación y despliegue gradual

- Validar respuestas HTTP sin JavaScript para una URL completa, una con fallback y un slug inexistente.
- Draft/archived nunca aparece en listados, detalle, JSON-LD ni sitemap.
- Verificar canonical, title, description, OG y redirects UUID → slug.
- Probar paginación, error Supabase y tenant/tipo incorrectos; no devolver lista vacía engañosa ni contenido de otro item.
- Comprobar móvil/tablet/escritorio, imágenes, navegación interna y enlaces anteriores.
- Desplegar una vez aprobado el preview; repetir preflight y comparar sitemap después.

## Prompt para el chat de IA de cada proyecto

Pega este encargo en el chat del sitio cliente junto con el export de items aprobados y el contrato `ITEMS_SEO_INTEGRATION.md`:

> Implementa SEO para los items CRM de este sitio SPA siguiendo el contrato adjunto. Primero audita el código y describe rutas, consultas, sitemap, estrategia de render y riesgos; no escribas en Supabase ni cambies datos. Usa únicamente el export proporcionado, que contiene items públicos del `company_id` y `item_type` indicados. Genera para cada item una propuesta de slug, seo_title (máx. 70), seo_description (máx. 160) y seo_og_image_url. No inventes características, precios, disponibilidad, claims ni URLs de imágenes; deja OG como NULL cuando no exista una imagen HTTPS comprobada. Devuelve una tabla con id, company_id, item_type y los cuatro campos SEO; detecta slug inválido/duplicado y cualquier cambio de URL anterior. Después prepara un SQL basado en `ITEMS_SEO_VALUES_TEMPLATE.sql`, limitado a esos IDs y solo a columnas SEO, pero no lo ejecutes. Implementa las rutas por slug, redirects permanentes desde URLs UUID, HTML inicial con metadatos, 404/noindex para no publicados, sitemap y revalidación. Mantén las consultas aisladas por tenant/tipo/estado y no introduzcas service-role en frontend. Añade pruebas y reporta qué queda pendiente para revisión humana.

La IA no tiene autorización para ejecutar SQL, desplegar ni leer otro tenant. Una persona revisa la redacción y el SQL, lo ejecuta en el Supabase correcto y valida el sitio.

## Orden y límites

Orden recomendado: **0 inventario → 1 preflight/export → 2 propuesta SEO → revisión humana → 3 SQL → 4 rutas → 5 HTML inicial → 6 sitemap/caché → 7 pruebas y despliegue**. Se puede desarrollar rutas en paralelo con la redacción, pero no se debe publicar una ruta indexable antes de que el slug exista y sea único.

`Navagli` ya consume `public.items` con un `company_id` y `item_type` fijos; su trabajo es completar estos pasos, no migrar a otra tabla. `moira_ordo` es legacy y `moiraOrdoNew` es el sitio vigente; según la auditoría registrada, sus contenidos relevantes son estáticos/locales y no entran en esta migración de items. Cualquier otro sitio debe auditarse antes de asumir que consume items.

## Datos necesarios para preparar un lote real

Hace falta un export autorizado de items publicados (IDs y contenido público) por sitio. Sin ese material no es posible redactar SEO específico fiable para cada item. No se han consultado bases remotas ni se han rellenado datos reales en esta tarea.
