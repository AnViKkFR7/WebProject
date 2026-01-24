import { supabase } from '../lib/supabaseClient'

/**
 * Service to handle Generic Items, Attribute Definitions, Attribute Values, and Media.
 */
export const itemService = {
  // --- Items ---

  async getItems(companyId, filters = {}) {
    let query = supabase
      .from('items')
      .select('*')
      .eq('company_id', companyId)

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.item_type) query = query.eq('item_type', filters.item_type)
    
    // Add more filters as needed

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getItemById(id) {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createItem(itemData) {
    const { data, error } = await supabase
      .from('items')
      .insert(itemData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateItem(id, updates) {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteItem(id) {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // --- Attribute Definitions ---

  async getAttributeDefinitions(companyId, itemType = null) {
    let query = supabase
      .from('attribute_definitions')
      .select('*')
      .eq('company_id', companyId)

    if (itemType) {
      query = query.eq('item_type', itemType)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async createAttributeDefinition(definitionData) {
    const { data, error } = await supabase
      .from('attribute_definitions')
      .insert(definitionData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateAttributeDefinition(id, updates) {
    const { data, error } = await supabase
      .from('attribute_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteAttributeDefinition(id) {
    const { error } = await supabase
      .from('attribute_definitions')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // --- Attribute Values ---

  async getAttributeValues(itemId) {
    // Fetch values and include definition info to know the key/label
    const { data, error } = await supabase
      .from('attribute_values')
      .select(`
        *,
        attribute_definitions (
          key,
          label,
          data_type
        )
      `)
      .eq('item_id', itemId)

    if (error) throw error
    return data
  },

  async upsertAttributeValue(valueData) {
    // valueData should contain item_id, attribute_id, and the specific value field (e.g. value_text)
    const { data, error } = await supabase
      .from('attribute_values')
      .upsert(valueData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteAttributeValue(id) {
    const { error } = await supabase
      .from('attribute_values')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // --- Item Media ---

  async getItemMedia(itemId) {
    const { data, error } = await supabase
      .from('item_media')
      .select('*')
      .eq('item_id', itemId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data
  },

  async addItemMedia(mediaData) {
    const { data, error } = await supabase
      .from('item_media')
      .insert(mediaData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateItemMedia(id, updates) {
    const { data, error } = await supabase
      .from('item_media')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteItemMedia(id) {
    const { error } = await supabase
      .from('item_media')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
