// node --test scripts/lib/legacyMedia.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { listBucketFiles, selectCandidates, encode, optimizeFiles, restoreFiles, MAX_SIDE } from './legacyMedia.mjs'

// Foto "de móvil": grande, con ruido (comprime mal) y girada por EXIF.
const noisyPhoto = async (width, height, format = 'jpeg', extra = {}) => {
  const channels = format === 'png' && extra.alpha ? 4 : 3
  const raw = Buffer.alloc(width * height * channels)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24
  const image = sharp(raw, { raw: { width, height, channels } })
  if (format === 'png') return image.png().toBuffer()
  return image.withMetadata({ orientation: extra.orientation ?? 1 }).jpeg({ quality: 98 }).toBuffer()
}

function fakeStorage(tree) {
  const uploads = []
  const files = new Map(Object.entries(tree.files))
  return {
    uploads, files,
    from: () => ({
      async list(prefix, { offset }) {
        const entries = tree.dirs[prefix] ?? []
        return { data: entries.slice(offset, offset + 1000), error: null }
      },
      async download(path) {
        if (path.includes('broken')) return { data: null, error: { message: 'Object not found' } }
        const buffer = files.get(path)
        return { data: new Blob([buffer]), error: null }
      },
      async upload(path, buffer, options) {
        if (path.includes('readonly')) return { error: { message: 'denied' } }
        uploads.push({ path, size: buffer.length, ...options })
        files.set(path, buffer)
        return { error: null }
      },
    }),
  }
}

test('lista los dos niveles empresa/item y descarta carpetas', async () => {
  const storage = fakeStorage({
    files: {},
    dirs: {
      '': [{ name: 'c1', id: null }],
      c1: [{ name: 'i1', id: null }],
      'c1/i1': [{ name: 'a.jpg', id: 'x', metadata: { size: 900000, mimetype: 'image/jpeg' } }, { name: '.emptyFolderPlaceholder', id: 'y', metadata: { size: 0 } }],
    },
  })
  const files = await listBucketFiles(storage)
  assert.deepEqual(files.map(file => file.path), ['c1/i1/a.jpg', 'c1/i1/.emptyFolderPlaceholder'])
})

test('solo selecciona JPG/PNG por encima del umbral, de mayor a menor, filtrando empresa', () => {
  const files = [
    { path: 'c1/i/a.jpg', size: 600_000, mimetype: 'image/jpeg' },
    { path: 'c1/i/b.webp', size: 900_000, mimetype: 'image/webp' },
    { path: 'c1/i/c.pdf', size: 900_000, mimetype: 'application/pdf' },
    { path: 'c1/i/d.png', size: 2_000_000, mimetype: 'image/png' },
    { path: 'c1/i/e.jpg', size: 100_000, mimetype: 'image/jpeg' },
    { path: 'c2/i/f.jpg', size: 3_000_000, mimetype: 'image/jpeg' },
  ]
  assert.deepEqual(selectCandidates(files, { minBytes: 500_000 }).map(f => f.path), ['c2/i/f.jpg', 'c1/i/d.png', 'c1/i/a.jpg'])
  assert.deepEqual(selectCandidates(files, { minBytes: 500_000, company: 'c1' }).map(f => f.path), ['c1/i/d.png', 'c1/i/a.jpg'])
})

test('reduce a 1920 px manteniendo formato y proporción, y endereza según EXIF', async () => {
  const jpeg = await encode(await noisyPhoto(3000, 2000), 'image/jpeg')
  assert.equal((await sharp(jpeg.buffer).metadata()).format, 'jpeg')
  assert.deepEqual([jpeg.width, jpeg.height], [MAX_SIDE, 1280])

  // Orientación 6 = foto vertical guardada en horizontal: debe quedar vertical
  // y sin la etiqueta EXIF (si no, el navegador la giraría dos veces).
  const rotated = await encode(await noisyPhoto(2400, 1600, 'jpeg', { orientation: 6 }), 'image/jpeg')
  const meta = await sharp(rotated.buffer).metadata()
  assert.deepEqual([meta.width, meta.height], [1280, MAX_SIDE])
  assert.equal(meta.orientation, undefined)

  const small = await encode(await noisyPhoto(800, 600), 'image/jpeg')
  assert.deepEqual([small.width, small.height], [800, 600], 'no se agranda')

  const png = await encode(await noisyPhoto(2500, 2500, 'png', { alpha: true }), 'image/png')
  const pngMeta = await sharp(png.buffer).metadata()
  assert.equal(pngMeta.format, 'png')
  assert.equal(pngMeta.hasAlpha, true, 'conserva la transparencia')
})

test('en modo informe no sube ni guarda nada', async () => {
  const photo = await noisyPhoto(3000, 2000)
  const storage = fakeStorage({ files: { 'c/i/a.jpg': photo }, dirs: {} })
  const saved = []
  const [row] = await optimizeFiles([{ path: 'c/i/a.jpg', size: photo.length, mimetype: 'image/jpeg' }], {
    storage, apply: false, backup: { save: async (...a) => saved.push(a) },
  })
  assert.equal(row.status, 'would_optimize')
  assert.ok(row.after < row.size)
  assert.equal(storage.uploads.length, 0)
  assert.equal(saved.length, 0)
})

test('al aplicar: copia primero, sube en la MISMA ruta y formato, y sigue tras un error', async () => {
  const photo = await noisyPhoto(3000, 2000)
  const storage = fakeStorage({ files: { 'c/i/a.jpg': photo, 'c/i/readonly.jpg': photo }, dirs: {} })
  const order = []
  const backup = { save: async (path, buffer, type) => { order.push(['backup', path, buffer.length, type, storage.uploads.length]) } }
  const files = [
    { path: 'c/i/broken.jpg', size: 3_000_000, mimetype: 'image/jpeg' },
    { path: 'c/i/readonly.jpg', size: photo.length, mimetype: 'image/jpeg' },
    { path: 'c/i/a.jpg', size: photo.length, mimetype: 'image/jpeg' },
  ]
  const results = await optimizeFiles(files, { storage, apply: true, backup })
  assert.match(results[0].status, /^error: Object not found/)
  assert.match(results[1].status, /^error: denied/)
  assert.equal(results[2].status, 'optimized')
  assert.deepEqual(storage.uploads.map(u => [u.path, u.contentType, u.upsert]), [['c/i/a.jpg', 'image/jpeg', true]])
  // La copia guarda el original intacto, antes de subir.
  assert.ok(order.some(([, path, size, type, uploadsBefore]) => path === 'c/i/a.jpg' && size === photo.length && type === 'image/jpeg' && uploadsBefore === 0))
  assert.ok(storage.files.get('c/i/a.jpg').length < photo.length)
})

test('si la copia falla no se sube nada', async () => {
  const photo = await noisyPhoto(3000, 2000)
  const storage = fakeStorage({ files: { 'c/i/a.jpg': photo }, dirs: {} })
  const [row] = await optimizeFiles([{ path: 'c/i/a.jpg', size: photo.length, mimetype: 'image/jpeg' }], {
    storage, apply: true, backup: { save: async () => { throw new Error('disco lleno') } },
  })
  assert.equal(row.status, 'error: disco lleno')
  assert.equal(storage.uploads.length, 0)
})

test('no toca fotos que ya están bien comprimidas', async () => {
  const already = await sharp(await noisyPhoto(1600, 1000)).jpeg({ quality: 70, mozjpeg: true }).toBuffer()
  const storage = fakeStorage({ files: { 'c/i/a.jpg': already }, dirs: {} })
  const [row] = await optimizeFiles([{ path: 'c/i/a.jpg', size: already.length, mimetype: 'image/jpeg' }], {
    storage, apply: true, backup: { save: async () => {} },
  })
  assert.equal(row.status, 'skip_little_gain')
  assert.equal(storage.uploads.length, 0)
})

test('restaurar sube el original con su tipo', async () => {
  const storage = fakeStorage({ files: {}, dirs: {} })
  await restoreFiles([{ path: 'c/i/a.png', buffer: Buffer.from('x'), contentType: 'image/png' }], { storage })
  assert.deepEqual(storage.uploads.map(u => [u.path, u.contentType, u.upsert]), [['c/i/a.png', 'image/png', true]])
})
