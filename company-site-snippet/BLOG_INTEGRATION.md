# Integración del blog público

Contrato para proyectos web que consumen el blog de Regiamare. Aplicar primero `database/migrations/CONTENT_SEO_FIELDS.sql` en Supabase. No usar nunca la clave `service_role` en una web pública.

## Datos disponibles

`blog_posts`: `id`, `company_id`, `title`, `heading`, `intro`, `body`, `status`, `created_at`, `updated_at`, `slug`, `seo_title`, `seo_description`, `seo_og_image_url`, `published_at`. `body` contiene Markdown. La migración fija `published_at` la primera vez que se publica y no lo cambia al editar o archivar.

`blog_media`: `id`, `post_id`, `file_type`, `url_externa`, `title`, `alt_text`, `sort_order`, `metadata`, `is_cover_image`, `created_at`. Solo consulta los medios a través de `post_id` devueltos por los posts publicados de esta empresa; la política pública deriva el acceso de que el post esté publicado. Para imágenes, filtra `file_type = 'image'`; usa `alt_text` y ordena por `sort_order`.

La tabla conserva el RLS existente: la web pública solo debe poder leer entradas publicadas y debe filtrar además por el `company_id` esperado. La clave anon/public es la única apropiada para el cliente.

La política pública permite leer cualquier post cuyo estado sea `published`, porque ese contenido se considera público. El filtro por `COMPANY_ID` evita mezclar publicaciones entre sitios, pero no es una barrera de confidencialidad frente a alguien que consulte Supabase directamente. No publiques contenido privado en un post publicado.

## Preflight antes de publicar rutas

`CONTENT_SEO_FIELDS.sql` deja `slug` nullable para no inventar slugs ni crear colisiones al migrar contenido existente. Antes de exponer el blog, ejecuta el fichero completo `database/maintenance/CONTENT_SEO_FIELDS_AUDIT.sql` en Supabase SQL Editor. Es de solo lectura y muestra posts publicados sin slug válido y slugs duplicados por compañía.

Si devuelve filas, edítalas desde Blog y guárdalas con un slug estable y único antes de publicar las rutas. Al guardar un post antiguo sin slug, el panel propone el slug derivado del título. No cambies slugs ya indexados sin configurar una redirección permanente.

Límites validados también en PostgreSQL: slug 120 caracteres y formato `palabras-con-guiones`; título SEO 70; descripción SEO 160; imagen Open Graph HTTPS hasta 2048 caracteres. El slug es único sin distinguir mayúsculas por empresa y tabla (posts e items pueden compartir la misma cadena).

## Consultas recomendadas

```js
const columns = 'id,company_id,title,heading,intro,body,status,slug,seo_title,seo_description,seo_og_image_url,published_at,created_at,updated_at'

const { data: posts, error } = await supabase
  .from('blog_posts')
  .select(columns)
  .eq('company_id', COMPANY_ID)
  .eq('status', 'published')
  .not('slug', 'is', null)
  .order('published_at', { ascending: false })
  .order('id', { ascending: false })

const { data: post, error: postError } = await supabase
  .from('blog_posts')
  .select(columns)
  .eq('company_id', COMPANY_ID)
  .eq('status', 'published')
  .eq('slug', slug)
  .maybeSingle()
```

Presenta el listado en `/blog` y el detalle en `/blog/:slug`. En una aplicación con varias empresas, la ruta debe resolver siempre con el `COMPANY_ID` de ese sitio; nunca aceptes el tenant desde un parámetro enviado por el visitante. Para el listado, pagina resultados si el blog puede crecer. Si una empresa no tiene posts publicados, se puede ocultar el enlace del menú.

Después de cargar posts, consulta sus imágenes en una segunda petición y limita los resultados a sus IDs:

```js
const postIds = posts.map(post => post.id)
let mediaByPost = new Map()

if (postIds.length) {
  const { data: media, error: mediaError } = await supabase
    .from('blog_media')
    .select('id,post_id,file_type,url_externa,title,alt_text,sort_order,is_cover_image')
    .in('post_id', postIds)
    .eq('file_type', 'image')
    .order('sort_order', { ascending: true })

  if (mediaError) throw mediaError
  mediaByPost = (media || []).reduce((grouped, item) => {
    const items = grouped.get(item.post_id) || []
    items.push(item)
    grouped.set(item.post_id, items)
    return grouped
  }, new Map())
}

const postsWithMedia = posts.map(post => ({
  ...post,
  media: mediaByPost.get(post.id) || [],
  cover: (mediaByPost.get(post.id) || []).find(item => item.is_cover_image) || null,
}))
```

Trata cualquier error de Supabase como error de carga y no lo conviertas en una lista vacía; escapa siempre el texto del blog.

## Seguridad y representación

- Renderiza `body` con un parser Markdown mantenido, con HTML embebido desactivado y enlaces limitados a protocolos seguros. En React, `react-markdown` con `skipHtml` es una opción; no insertes el contenido con `dangerouslySetInnerHTML` sin sanitización.
- No consultes ni expongas estados `draft` o `archived` desde rutas públicas. RLS es la barrera de seguridad; el filtro de estado no la sustituye.
- El slug es único sin distinguir mayúsculas por empresa y tipo de contenido. Mantén rutas estables y gestiona `404` cuando no exista un post publicado.
- Usa `seo_title` y `seo_description`; si faltan, recurre a `title` e `intro`/`heading`. `seo_og_image_url` es opcional y debe ser HTTPS.
- Los campos SEO también existen en `items`: `slug`, `seo_title`, `seo_description` y `seo_og_image_url`.

## SEO social y publicación

Un cambio de `document.title` en React no basta para que todos los rastreadores lean las etiquetas sociales. La página pública debe entregar o prerenderizar HTML inicial con `<title>`, descripción, canonical y Open Graph (`og:title`, `og:description`, `og:image`, `og:url`). Usa `seo_title || title` y `seo_description || intro || heading`; la imagen puede caer a la portada publicada solo si su URL es HTTPS; si no, omite `og:image`. Construye las URLs con el dominio público configurado y escapa valores al escribir atributos HTML. Configura sitemap con solo contenido publicado y URLs canónicas. Comprueba la respuesta HTML sin ejecutar JavaScript.

Antes de dar por terminada la integración, prueba: listado; slug inexistente y borrador (ambos 404); que un post de otra empresa no se mezcle al resolver usando el `COMPANY_ID` de este sitio; post antiguo sin slug detectado por el preflight; medios con alt; OG/canonical en el HTML inicial; y sitemap sin borradores ni archivados.

La SPA de administración guarda el contenido y sus metadatos, pero no publica por sí misma rutas públicas ni etiquetas SEO en los otros proyectos. La integración de cada web cliente debe implementar sus rutas y renderizado usando este contrato.
