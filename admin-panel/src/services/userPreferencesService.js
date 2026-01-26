import { supabase } from '../lib/supabaseClient'

/**
 * Service to handle user filter preferences
 */
export const userPreferencesService = {
  async getFilterPreferences(userId, page) {
    const { data, error } = await supabase
      .from('user_filter_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('page', page)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found", which is ok
      throw error
    }
    return data
  },

  async saveFilterPreferences(userId, page, filterConfig) {
    const { data, error } = await supabase
      .from('user_filter_preferences')
      .upsert({
        user_id: userId,
        page,
        filter_config: filterConfig
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteFilterPreferences(userId, page) {
    const { error } = await supabase
      .from('user_filter_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('page', page)

    if (error) throw error
  }
}
