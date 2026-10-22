import { supabase } from '../lib/supabaseClient'
import { valueColumnFor, castFilterValue, isArrayType, distinctValues } from '../lib/itemFilters'

/**
 * Service to handle Generic Items, Attribute Definitions, Attribute Values, and Media.
 */
export const itemService = {
  // --- Items ---

  /**
   * Items paginados de una empresa. Los filtros por atributo se resuelven en
   * el servidor (antes se filtraba en el navegador DESPUÉS de paginar: un
   * filtro podía dejar la página 1 vacía con coincidencias en la 3, y el total
   * de páginas no cuadraba).
   *
   * advancedFilters: { [definitionId]: string[] }
   * definitions: attribute_definitions de la empresa (para saber el tipo)
   */
  async getItems(companyId, filters = {}, page = 1, pageSize = 20, advancedFilters = {}, definitions = []) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const definitionsById = Object.fromEntries(definitions.map((d) => [d.id, d]))
    const activeAttrFilters = Object.entries(advancedFilters || {})
      .filter(([defId, values]) => values?.length && definitionsById[defId])

    // Un alias !inner por atributo: cada uno exige que exista SU fila de
    // attribute_values que cumpla, así se combinan como AND.
    let select = '*, attribute_values(*, attribute_definitions(*))'
    activeAttrFilters.forEach(([defId], i) => {
      const column = valueColumnFor(definitionsById[defId].data_type)
      select += `, f${i}:attribute_values!inner(attribute_id, ${column})`
    })

    let query = supabase
      .from('items')
      .select(select, { count: 'exact' })
      .eq('company_id', companyId)

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters.item_type && filters.item_type.length > 0) {
      query = query.in('item_type', filters.item_type)
    }
    if (filters.title_search && filters.title_search.trim()) {
      query = query.ilike('title', `%${filters.title_search.trim()}%`)
    }

    activeAttrFilters.forEach(([defId, values], i) => {
      const dataType = definitionsById[defId].data_type
      const column = valueColumnFor(dataType)
      const casted = values.map((v) => castFilterValue(dataType, v)).filter((v) => v !== null)
      query = query.eq(`f${i}.attribute_id`, defId)
      query = isArrayType(dataType)
        ? query.overlaps(`f${i}.${column}`, casted)
        : query.in(`f${i}.${column}`, casted)
    })

    if (filters.sort_by_date) {
      query = query.order('created_at', { ascending: filters.sort_by_date === 'asc' })
    } else {
      query = query.order('updated_at', { ascending: false })
    }

    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) throw error

    return {
      data,
      count: count ?? 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize))
    }
  },

  async getItemsByAdvancedFilters(companyId, filters = {}, advancedFilters = {}, page = 1, pageSize = 20, definitions = []) {
    return this.getItems(companyId, filters, page, pageSize, advancedFilters, definitions)
  },

  /**
   * Opciones de los filtros por atributo, sacadas de TODA la empresa (antes
   * sólo de los 20 items de la página visible).
   */
  async getAttributeFilterOptions(definitions) {
    if (!definitions.length) return {}
    const { data, error } = await supabase
      .from('attribute_values')
      .select('attribute_id, value_text, value_number, value_boolean, value_date, value_text_array, value_number_array')
      .in('attribute_id', definitions.map((d) => d.id))
      .limit(5000)
    if (error) throw error

    const options = {}
    for (const def of definitions) {
      options[def.id] = distinctValues(data.filter((row) => row.attribute_id === def.id), def.data_type)
    }
    return options
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

  /**
   * Portadas para la vista de cards: usa la vista item_media_summary
   * (cover_url ya resuelta) en vez de traer item_media completo.
   */
  async getItemMediaSummaries(itemIds) {
    if (!itemIds || itemIds.length === 0) return []

    const { data, error } = await supabase
      .from('item_media_summary')
      .select('item_id, cover_url')
      .in('item_id', itemIds)

    if (error) throw error
    return data
  },

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
