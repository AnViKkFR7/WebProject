// Compresión en el navegador antes de subir: la usan Items y el Blog.
/**
 * Compresses and converts an image file to WebP.
 * Resizes so neither side exceeds maxPx; then encodes at given quality (0–1).
 */
export const compressToWebP = (file, maxPx = 1920, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round(h * (maxPx / w)); w = maxPx }
        else        { w = Math.round(w * (maxPx / h)); h = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error(`No se pudo comprimir: ${file.name}`))
          const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
          resolve(Object.assign(new File([blob], name, { type: 'image/webp' }), { width: w, height: h }))
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo leer: ${file.name}`)) }
    img.src = url
  })
