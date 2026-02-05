import { supabase } from '../lib/supabaseClient'

const itemMediaService = {
  /**
   * Get all media for an item
   */
  async getItemMedia(itemId) {
    const { data, error } = await supabase
      .from('item_media')
      .select('*')
      .eq('item_id', itemId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Upload a new file using Edge Function
   */
  async uploadMedia(file, itemId, fileType, altText = '', isCover = false, sortOrder = 0) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('item_id', itemId)
    formData.append('file_type', fileType)
    formData.append('alt_text', altText)
    formData.append('is_cover', isCover.toString())
    formData.append('sort_order', sortOrder.toString())

    const { data, error } = await supabase.functions.invoke('upload-item-media', {
      body: formData
    })

    if (error) throw error
    if (!data.success) throw new Error(data.error || 'Upload failed')
    
    return data.data
  },

  /**
   * Update media metadata (description, order, cover)
   */
  async updateMedia(mediaId, updates) {
    const { data, error } = await supabase
      .from('item_media')
      .update(updates)
      .eq('id', mediaId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete media using Edge Function (removes from DB and Storage)
   */
  async deleteMedia(mediaId) {
    const { data, error } = await supabase.functions.invoke('delete-item-media', {
      body: { media_id: mediaId }
    })

    if (error) throw error
    if (!data.success) throw new Error(data.error || 'Delete failed')
    
    return data
  },

  /**
   * Reorder multiple media items
   */
  async reorderMedia(mediaItems) {
    const updates = mediaItems.map((item, index) => 
      supabase
        .from('item_media')
        .update({ sort_order: index })
        .eq('id', item.id)
    )

    const results = await Promise.all(updates)
    const errors = results.filter(r => r.error)
    
    if (errors.length > 0) {
      throw new Error('Failed to reorder some items')
    }

    return true
  },

  /**
   * Set a new cover image (unsets previous cover)
   */
  async setCoverImage(itemId, mediaId) {
    // Use SQL function to set cover atomically (avoids trigger conflicts)
    const { error } = await supabase.rpc('set_item_cover', {
      _item_id: itemId,
      _media_id: mediaId
    })

    if (error) throw error
    return true
  }
}

export { itemMediaService }
