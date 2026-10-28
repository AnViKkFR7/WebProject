# Items públicos y SEO — contrato para webs cliente

Guía para consumir desde un sitio público los items gestionados en Admin y utilizar su SEO. **No incluye el blog**, que tiene contrato propio en `BLOG_INTEGRATION.md` y permanece aplazado como feature separada.

## 1. Qué ofrece el panel y qué no

El editor de Items guarda título, resumen, tipo, estado, valores de atributos y medios. Con `database/migrations/CONTENT_SEO_FIELDS.sql` también guarda `slug`, `seo_title`, `seo_description` y `seo_og_image_url`. El panel valida el slug y los límites de longitud, y Supabase aplica restricciones e índice único por empresa.

Estos campos solo se vuelven visibles en Google/redes si el sitio público carga el item correcto y genera sus etiquetas. **Admin no crea rutas del sitio cliente, no cambia su navegación ni genera el sitemap de esos dominios.**

## 2. Datos y entorno

Usar la URL y clave anon/public del proyecto Supabase. El cliente público debe fijar un `COMPANY_ID` de configuración, normalmente `VITE_COMPANY_ID`; nunca elegir tenant desde query params o formulario. No poner `SUPABASE_SERVICE_ROLE_KEY` en el frontend.

Columnas mínimas de consulta:

```js
const ITEM_SEO_COLUMNS =
  'id,company_id,title,summary,item_type,status,slug,seo_title,seo_description,seo_og_image_url,created_at,updated_at'
```

Resolver un item de una ruta `/items/:slug` así:

```js
const { data: item, error } = await supabase
  .from('items')
  .select(ITEM_SEO_COLUMNS)
  .eq('company_id', COMPANY_ID)
  .eq('status', 'published')
  .eq('slug', slug)
  .maybeSingle()

if (error) throw error
if (!item) return notFound()
```

No convertir errores de conexión en 404 ni en una lista vacía; mostrar un estado de error/reintento. La política pública de items filtra `status='published'`, pero la web debe filtrar también `company_id`. Los campos visibles en un item publicado se consideran públicos.

Para un listado, pagina y ordena resultados con un criterio estable:

```js
const { data, error } = await supabase
  .from('items')
  .select(ITEM_SEO_COLUMNS)
  .eq('company_id', COMPANY_ID)
  .eq('status', 'published')
  .not('slug', 'is', null)
  .order('updated_at', { ascending: false })
  .order('id', { ascending: false })
  .range(from, to)
```

Las imágenes viven en `item_media`, sin `company_id` propio; consulta solo IDs de items publicados que ya se resolvieron:

```js
const { data: media, error } = await supabase
  .from('item_media')
  .select('id,item_id,file_type,url_externa,title,alt_text,sort_order')
  .in('item_id', publishedItemIds)
  .eq('file_type', 'image')
  .order('sort_order', { ascending: true })
```

Si `publishedItemIds` está vacío, omite la consulta. Usa `alt_text`; valida URL antes de renderizar. Atributos se consultan mediante las tablas `attribute_definitions`/`attribute_values` y los IDs de item; no interpolar HTML almacenado como atributo.

## 3. Campos SEO y fallback

| Salida | Valor recomendado |
|---|---|
| `<title>` y `og:title` | `seo_title || title` |
| `meta description` y `og:description` | `seo_description || summary || ''` |
| Slug/ruta | `slug` obligatorio para ruta indexable |
| `og:image` | `seo_og_image_url` si es HTTPS; si falta, usar una imagen pública HTTPS del item; si ninguna cumple, omitir |
| Canonical | URL absoluta canónica de ese slug en el dominio público configurado |
| Robots | `index,follow` para item publicado válido; `noindex` para errores/no indexables y 404 para item no encontrado |

Límites del contrato de base de datos: slug hasta 120 caracteres y patrón `palabras-con-guiones`; título SEO hasta 70; descripción hasta 160; imagen OG HTTPS hasta 2048 caracteres. El slug es único sin distinguir mayúsculas dentro de la compañía y tabla. No cambies slugs ya indexados sin redirección permanente desde la URL anterior.

No inventes precio, disponibilidad ni datos de Schema.org con valores de atributos sin mapear primero el `item_type` y su significado. Si se genera JSON-LD, escapar/serializarlo de forma segura y probar que valores como `<` no puedan cerrar el `script`.

## 4. Entrega SEO en el HTML

Las etiquetas que se añaden solo en `useEffect`/al cambiar `document.title` sirven para la navegación del usuario, pero no garantizan etiquetas indexables para crawlers ni vistas previas de redes. Para rutas dinámicas de items, el HTML inicial debe contener title, descripción, canonical, `og:title`, `og:description`, `og:url`, `og:image` cuando exista y robots.

Implementar una de estas estrategias y probar la respuesta HTTP sin ejecutar JavaScript:

1. SSR para cada slug resolviendo el item desde servidor con credenciales públicas/anon; o
2. generación HTML/prerender con regeneración tras cambios de items y sitemap.

Una SPA estática que solo cambia `<head>` en el navegador no cierra por sí sola el requisito SEO. El servidor no necesita `service_role` para leer filas públicas; si se utiliza una función server-side, no debe convertirla en un endpoint de lectura de borradores.

## 5. URL, sitemap y caché

- Mantener una ruta estable, por ejemplo `/items/:slug`, y una vista 404 real para slugs inexistentes/no publicados.
- Sitemap solo con items publicados y slugs válidos; canonical y sitemap deben usar el mismo dominio y protocolo.
- Si la fuente devuelve un item sin slug, no construir una URL indexable con su UUID: completar el slug en Admin y revisar unicidad antes de publicar la ruta.
- Definir una política de caché y revalidación acorde al proceso editorial. Un cambio de slug requiere invalidar la ruta anterior, la nueva, canonical y sitemap.
- Si un item se archiva/despublica, quitarlo del listado y sitemap; responder 404 o redirección únicamente si existe una URL sustituta válida.

## 6. Privacidad y aislamiento

- El filtro de estado público permite que usuarios anónimos lean items publicados de distintas empresas si consultan Supabase directamente; por eso fijar `COMPANY_ID` impide mezclas en la web propia pero no es una frontera de confidencialidad en la base.
- No publicar datos personales, internos, notas CRM ni documentos financieros en items públicos.
- La consulta por `company_id` debe estar en listado, detalle, metadatos, imágenes relacionadas, JSON-LD y sitemap.
- No usar `service_role` en el navegador. No confiar en `company_id` que llega del visitante.

## 7. Pruebas requeridas

1. Item publicado con todos los campos y otro con fallbacks; comprobar `<head>` en HTML inicial.
2. Draft, archived y slug inexistente: 404/noindex; no aparecen en listado ni sitemap.
3. Slug duplicado/no válido: el guardado falla con mensaje útil; un slug antiguo mantiene su URL o tiene redirección permanente.
4. Aislamiento: resolver cada item solo con el `COMPANY_ID` fijado para el sitio; no cruzar tenant en listados, detalle, imágenes, metadatos o sitemap.
5. Imágenes con alt, URL inválida y ausencia de OG image; sin imagen deformada ni `og:image` insegura.
6. Comprobar la respuesta renderizada por HTTP/curl sin ejecutar JavaScript, canonical, OG y sitemap después de publicar/cambiar/archivar.
7. Probar errores de Supabase y paginación sin mostrar draft como fallback.

## 8. Aplicación en Navagli (auditoría 28/10/2026)

Navagli **ya lee el catálogo de la tabla compartida `public.items`**; no necesita migrar sus proyectos desde una tabla separada. `src/services/projectsService.js` fija `COMPANY_ID = b58a5ab9-dd4a-4bbe-8289-2cf3a134e49a` y `ITEM_TYPE = proyecto-reforma-navagli`. El listado filtra por empresa, tipo y estado publicado. Lee atributos en `attribute_values`/`attribute_definitions` y medios en `item_media` (`is_cover`).

Lo que falta es aprovechar el SEO que ya está en `items` y cambiar con cuidado las URLs públicas:

1. **Completar/revisar los datos SEO de esos items** en Admin: `slug`, `seo_title`, `seo_description`, `seo_og_image_url`. `CONTENT_SEO_FIELDS.sql` añade esas columnas a `items`; la migración solo cambia el esquema, no rellena slugs o metadatos existentes. El índice único es por `company_id` para todos los tipos de item, así que el slug de Navagli no puede colisionar con otro item de esa misma empresa aunque tenga otro `item_type`.
2. **Usar slugs en rutas y tarjetas:** hoy `ProjectCard` enlaza a `/proyectos/${project.id}` y React Router usa `/proyectos/:id`; `ProjectDetailPage` carga con el UUID. La futura ruta debería ser `/proyectos/:slug` y resolver con `.eq('company_id', COMPANY_ID).eq('item_type', ITEM_TYPE).eq('status', 'published').eq('slug', slug)`. Mantén durante la transición la ruta UUID; resolverla y responder con redirección permanente al slug evita romper enlaces ya compartidos/indexados. La búsqueda por UUID también debe filtrar `item_type` y `status`, como el listado.
3. **Generar metadatos por item:** título `seo_title || title`; descripción `seo_description || summary`; canonical absoluto `/proyectos/:slug`; OG image solo HTTPS desde `seo_og_image_url`, con fallback a la imagen `item_media.is_cover` si su URL es HTTPS. Escapar los valores.
4. **Dar HTML al crawler antes de React:** las rutas `/proyectos/:id` actuales caen en el rewrite global a `/index.html`; la pantalla del proyecto se llena después en el navegador. El cambio solo de `document.title` en React no basta para SEO social/HTML inicial. Navagli ya tiene patrón server-side para el blog: rewrite `/blog/:slug` a `api/blog-page.js`, que lee datos públicos y devuelve HTML con metadatos y contenido. Se puede aplicar el mismo patrón para `/proyectos/:slug` (por ejemplo `api/project-page.js`) y conservar la vista React para navegación normal.
5. **Incluirlos en `api/sitemap.js`:** el sitemap actual añade páginas estáticas y slugs de `blog_posts`, pero no proyectos. Consultar `items` por el UUID fijo, `item_type` y `status='published'`, exigir slug válido y añadir `/proyectos/:slug` junto a `lastmod` basado en `updated_at`.
6. **Probar con los datos de Navagli y sin modificar contenido:** el preflight debe detectar slugs vacíos/inválidos/duplicados para la empresa y tipo; comparar el número de URLs del sitemap con los items publicados; validar 404 para drafts/archived y redirect UUID→slug. La columna `slug` puede compartirse con otros tipos bajo la misma empresa, debido al índice único actual.

`moira_ordo` es el sitio legacy y usa páginas estáticas. `moiraOrdoNew` es el sitio vigente y usa datos estáticos/locales para sus servicios y casos; ninguno de esos dos consume Items del CRM. El alcance de esta sección se limita a Navagli y a esos items. No se han cambiado sus rutas ni registros.
