# Optimizar fotos antiguas de items-media

Las fotos subidas antes de que el panel comprimiera al subir son JPG/PNG de
varios MB (en noviembre de 2026: 102 JPG, 227 MB, media 2,3 MB). Este script
las recomprime **en su misma ruta y con su mismo formato**:

- No cambia ninguna URL: item_media, blog, Open Graph y enlaces compartidos siguen igual.
- No modifica la base de datos ni dispara triggers (la cola de limpieza de Storage no interviene).
- Lado máximo 1920 px (como el panel), JPEG mozjpeg calidad 82, PNG sin pérdida (conserva transparencia).
- Endereza según EXIF y quita metadatos (incluida la ubicación GPS).
- Solo sustituye si ahorra al menos un 20 %. Las WebP ya optimizadas no se tocan.
- Guarda antes el original en `database/local/media-backup/` (ignorado por git). Sin copia, no sube.

## Pasos

1. Crear `database/local/media-optimizer.env` (nunca en git):
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
2. Informe sin cambios: `npm run media:optimize` (opciones `--min-kb=500`, `--limit=10`, `--company=<uuid>`).
   Deja un CSV en `database/local/`.
3. Prueba pequeña: `npm run media:optimize -- --apply --limit=3` y revisar esas fotos en la web.
4. Resto: `npm run media:optimize -- --apply`. Se puede repetir: las ya optimizadas quedan por debajo del umbral.
5. Deshacer: `npm run media:optimize -- --restore` (muestra cuántas) y `-- --restore --yes`.
6. Conservar `media-backup/` hasta comprobar las webs; luego puede borrarse en local.

## Límites

- Ante cortes de red (`fetch failed`, `terminated`, 5xx, 429) reintenta cada descarga y subida hasta 3 veces (2 s, 5 s, 15 s). Si una foto sigue fallando queda como `error` en el CSV y no se toca; basta con repetir el comando.

- La CDN y los navegadores pueden servir la versión anterior hasta 1 h (caché por defecto del bucket).
- El ahorro de egress se nota a partir de ese momento, no retroactivamente en el ciclo actual.
- Pruebas: `npm run test:scripts` (Storage simulado e imágenes generadas). No probado contra Supabase real.
