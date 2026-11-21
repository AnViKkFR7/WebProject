import { supabase } from '../lib/supabaseClient'

export const BLOG_BUCKET = 'blog-media'
export const BLOG_MAX_IMAGES = 3

/** Ruta del objeto dentro del bucket a partir de su URL pública (o null si no es nuestra). */
export function blogObjectPath(url) {
  const match = String(url || '').match(/\/storage\/v1\/object\/public\/blog-media\/([0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(?:webp|jpe?g|png))$/)
  return match ? match[1] : null
}

/**
 * Service to handle Blog operations.
 */
export const blogService = {
  // --- Blog Posts ---

  async getPosts(companyId, filters = {}) {
    let query = supabase
      .from('blog_posts')
      .select('*')
      .eq('company_id', companyId)

    if (filters.status) query = query.eq('status', filters.status)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getPostById(id) {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createPost(postData) {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert(postData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePost(id, updates) {
    const { data, error } = await supabase
      .from('blog_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletePost(id) {
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // --- Blog Media ---

  async getPostMedia(postId) {
    const { data, error } = await supabase
      .from('blog_media')
      .select('*')
      .eq('post_id', postId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data
  },

  async addPostMedia(mediaData) {
    const { data, error } = await supabase
      .from('blog_media')
      .insert(mediaData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePostMedia(id, updates) {
    const { data, error } = await supabase
      .from('blog_media')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletePostMedia(id) {
    const { error } = await supabase
      .from('blog_media')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // --- Imágenes del editor (hasta 3, una portada) ---

  /** Sube una imagen ya comprimida a blog-media/<empresa>/<artículo>/. */
  async uploadImage(companyId, postId, file) {
    const path = `${companyId}/${postId}/${Date.now()}_${crypto.randomUUID()}.webp`
    const { error } = await supabase.storage.from(BLOG_BUCKET)
      // El nombre es único y no se reutiliza: se puede cachear un año.
      .upload(path, file, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    if (error) throw error
    return supabase.storage.from(BLOG_BUCKET).getPublicUrl(path).data.publicUrl
  },

  /** Borra el archivo de Storage. Un fallo aquí no debe romper el guardado. */
  async removeImageObject(url) {
    const path = blogObjectPath(url)
    if (!path) return
    const { error } = await supabase.storage.from(BLOG_BUCKET).remove([path])
    if (error) console.warn('[blog] No se pudo borrar la imagen antigua', error.message)
  },

  /**
   * Deja las imágenes del artículo como `images` (orden = posición).
   * Cada entrada es { id?, url_externa?, file?, alt_text, is_cover_image }.
   * Orden de operaciones pensado para las reglas del servidor: primero se
   * borran las quitadas y se desmarca la portada; al final se marca la nueva.
   * Si algo falla, el error lleva `saved` con las filas ya guardadas (por
   * posición) para que un reintento no vuelva a subir las mismas imágenes.
   */
  async syncImages(companyId, postId, images, previous = []) {
    if (images.length > BLOG_MAX_IMAGES) throw new Error('too_many_images')
    const keep = new Set(images.filter(image => image.id).map(image => image.id))
    for (const old of previous.filter(image => !keep.has(image.id))) {
      await this.deletePostMedia(old.id)
      await this.removeImageObject(old.url_externa)
    }
    const saved = []
    try {
      await this.saveImageRows(companyId, postId, images, saved)
    } catch (error) {
      error.saved = saved
      throw error
    }
    const coverIndex = Math.max(0, images.findIndex(image => image.is_cover_image))
    if (saved[coverIndex]) saved[coverIndex] = await this.updatePostMedia(saved[coverIndex].id, { is_cover_image: true })
    return saved
  },

  async saveImageRows(companyId, postId, images, saved) {
    for (const [index, image] of images.entries()) {
      const fields = { alt_text: image.alt_text?.trim() || null, sort_order: index, is_cover_image: false }
      if (image.id) {
        saved.push(await this.updatePostMedia(image.id, fields))
        continue
      }
      const url = await this.uploadImage(companyId, postId, image.file)
      try {
        saved.push(await this.addPostMedia({
          ...fields, post_id: postId, file_type: 'image', url_externa: url,
          metadata: image.file?.width ? { width: image.file.width, height: image.file.height } : null,
        }))
      } catch (error) {
        await this.removeImageObject(url)
        throw error
      }
    }
  },
}
