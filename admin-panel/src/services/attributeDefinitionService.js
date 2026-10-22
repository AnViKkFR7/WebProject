import { supabase } from '../lib/supabaseClient'
import { sortDefinitions } from '../lib/attributeTypes'

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

    // Se ordena en cliente: así funciona también antes de crear la columna sort_order
    const { data, error } = await query
    if (error) throw error
    return sortDefinitions(data)
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

  async createDefinitions(rows) {
    const { error } = await supabase.from('attribute_definitions').insert(rows)
    if (error) throw error
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
    // Primero los valores: en la BD la FK no siempre tiene ON DELETE CASCADE
    const { error: valuesError } = await supabase
      .from('attribute_values')
      .delete()
      .eq('attribute_id', id)
    if (valuesError) throw valuesError

    const { error } = await supabase
      .from('attribute_definitions')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /** Cuántos items tienen un valor en este atributo (para avisar antes de borrar o cambiar el tipo) */
  async countValues(attributeId) {
    const { count, error } = await supabase
      .from('attribute_values')
      .select('id', { count: 'exact', head: true })
      .eq('attribute_id', attributeId)
    if (error) throw error
    return count || 0
  },

  /** Guarda el orden: [{ id, sort_order }] */
  async saveOrder(definitions) {
    const results = await Promise.all(definitions.map(({ id, sort_order }) =>
      supabase.from('attribute_definitions').update({ sort_order }).eq('id', id)))
    const failed = results.find((result) => result.error)
    if (failed) throw failed.error
  },

  /** Resumen por tipo de item: nº de atributos y nº de items */
  async getItemTypeSummary(companyId) {
    const [definitions, items] = await Promise.all([
      supabase.from('attribute_definitions').select('item_type').eq('company_id', companyId),
      supabase.from('items').select('item_type').eq('company_id', companyId),
    ])
    if (definitions.error) throw definitions.error
    if (items.error) throw items.error

    const summary = new Map()
    const bump = (type, field) => {
      if (!type) return
      const entry = summary.get(type) || { itemType: type, attributes: 0, items: 0 }
      entry[field] += 1
      summary.set(type, entry)
    }
    definitions.data.forEach((row) => bump(row.item_type, 'attributes'))
    items.data.forEach((row) => bump(row.item_type, 'items'))
    return [...summary.values()].sort((a, b) => a.itemType.localeCompare(b.itemType))
  },

  async getUniqueItemTypes(companyId) {
    const { data, error } = await supabase
      .from('attribute_definitions')
      .select('*')
      .eq('company_id', companyId)

    if (error) throw error

    // Get unique types
    const uniqueTypes = [...new Set(data.map(item => item.item_type))]
    return uniqueTypes
  }
}
