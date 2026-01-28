import { supabase } from '../lib/supabaseClient'

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
  }
}
