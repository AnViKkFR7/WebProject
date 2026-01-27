import { supabase } from '../lib/supabaseClient'

/**
 * Service to handle Generic Items, Attribute Definitions, Attribute Values, and Media.
 */
export const itemService = {
  // --- Items ---

  async getItems(companyId, filters = {}, page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('items')
      .select('*, attribute_values(*, attribute_definitions(*))', { count: 'exact' })
      .eq('company_id', companyId)

    // Fixed filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters.item_type && filters.item_type.length > 0) {
      query = query.in('item_type', filters.item_type)
    }

    // Sorting
    if (filters.sort_by_date) {
      query = query.order('created_at', { ascending: filters.sort_by_date === 'asc' })
    } else {
      query = query.order('updated_at', { ascending: false })
    }

    // Pagination
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) throw error

    return {
      data,
      count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    }
  },

  async getItemsByAdvancedFilters(companyId, filters = {}, advancedFilters = {}, page = 1, pageSize = 20) {
    // First get basic items
    const result = await this.getItems(companyId, filters, page, pageSize)
    
    // If no advanced filters, return as is
    if (!advancedFilters || Object.keys(advancedFilters).length === 0) {
      return result
    }

    // Filter items based on attribute values
    const filteredData = result.data.filter(item => {
      if (!item.attribute_values) return false
      
      return Object.entries(advancedFilters).every(([attributeId, selectedValues]) => {
        if (!selectedValues || selectedValues.length === 0) return true
        
        const attributeValue = item.attribute_values.find(av => av.attribute_id === attributeId)
        if (!attributeValue) return false
        
        const definition = attributeValue.attribute_definitions
        if (!definition) return false

        // Get the actual value based on data type
        let actualValue
        switch (definition.data_type) {
          case 'text':
            actualValue = attributeValue.value_text
            break
          case 'number':
            actualValue = attributeValue.value_number
            break
          case 'boolean':
            actualValue = attributeValue.value_boolean
            break
          case 'date':
            actualValue = attributeValue.value_date
            break
          case 'text_array':
            actualValue = attributeValue.value_text_array
            break
          case 'number_array':
            actualValue = attributeValue.value_number_array
            break
          default:
            actualValue = attributeValue.value_text
        }

        // Check if the value matches any of the selected filter values
        if (Array.isArray(actualValue)) {
          return selectedValues.some(sv => actualValue.includes(sv))
        }
        return selectedValues.includes(String(actualValue))
      })
    })

    return {
      ...result,
      data: filteredData,
      count: filteredData.length
    }
  },

  async getItemById(id) {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        attribute_values(
          *,
          attribute_definitions(*)
        )
      `)
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
      .upsert(valueData, {
        onConflict: 'item_id,attribute_id'
      })
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
