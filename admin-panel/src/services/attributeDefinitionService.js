import { supabase } from '../lib/supabaseClient'

/**
 * Service to handle attribute definitions
 */
export const attributeDefinitionService = {
  async getDefinitions(companyId, itemType = null) {
    let query = supabase
      .from('attribute_definitions')
      .select('*')
      .eq('company_id', companyId)

    if (itemType) {
      query = query.eq('item_type', itemType)
    }

    const { data, error } = await query.order('label', { ascending: true })
    if (error) throw error
    return data
  },

  async getDefinitionById(id) {
    const { data, error } = await supabase
      .from('attribute_definitions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createDefinition(definitionData) {
    const { data, error } = await supabase
      .from('attribute_definitions')
      .insert(definitionData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateDefinition(id, updates) {
    const { data, error } = await supabase
      .from('attribute_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteDefinition(id) {
    const { error } = await supabase
      .from('attribute_definitions')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getUniqueItemTypes(companyId) {
    const { data, error } = await supabase
      .from('items')
      .select('item_type')
      .eq('company_id', companyId)

    if (error) throw error

    // Get unique types
    const uniqueTypes = [...new Set(data.map(item => item.item_type))]
    return uniqueTypes
  }
}
