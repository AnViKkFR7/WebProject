import { supabase } from '../lib/supabaseClient'

/**
 * Service to handle analytics: event definitions (per-company, admin-managed)
 * and daily rollups (read-only, written by the ingestion endpoint + the
 * pg_cron aggregation job).
 */
export const analyticsService = {
  async getEventDefinitions(companyId) {
    const { data, error } = await supabase
      .from('analytics_event_definitions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  },

  async createEventDefinition({ companyId, key, label }) {
    const { data, error } = await supabase
      .from('analytics_event_definitions')
      .insert({ company_id: companyId, key, label })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateEventDefinition(id, updates) {
    const { data, error } = await supabase
      .from('analytics_event_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async setEventDefinitionActive(id, isActive) {
    return this.updateEventDefinition(id, { is_active: isActive })
  },

  /**
   * Fuerza una agregación inmediata del día de hoy para esta empresa (RPC
   * `trigger_company_analytics_aggregation`, valida el rol en el propio
   * servidor). Útil para probar la integración sin esperar al cron.
   */
  async aggregateNow(companyId) {
    const { error } = await supabase.rpc('trigger_company_analytics_aggregation', {
      target_company_id: companyId
    })
    if (error) throw error
  },

  async getDailyAnalytics(companyId, startDate, endDate) {
    const { data, error } = await supabase
      .from('analytics_daily')
      .select('*')
      .eq('company_id', companyId)
      .gte('day', startDate)
      .lte('day', endDate)
      .order('day', { ascending: true })

    if (error) throw error
    return data
  }
}

/**
 * Suma un conjunto de filas analytics_daily en un único resumen del rango:
 * totales + objetos by_path/by_device/by_country/by_event fusionados.
 */
export function summarizeDailyRows(rows) {
  const summary = {
    uniqueVisitors: 0,
    pageViews: 0,
    byPath: {},
    byDevice: {},
    byCountry: {},
    byEvent: {}
  }

  const mergeInto = (target, source) => {
    for (const [key, count] of Object.entries(source || {})) {
      target[key] = (target[key] || 0) + count
    }
  }

  for (const row of rows) {
    summary.uniqueVisitors += row.unique_visitors || 0
    summary.pageViews += row.page_views || 0
    mergeInto(summary.byPath, row.by_path)
    mergeInto(summary.byDevice, row.by_device)
    mergeInto(summary.byCountry, row.by_country)
    mergeInto(summary.byEvent, row.by_event)
  }

  return summary
}

/** { "/servicios": 12, "/": 84 } -> [{ name: "/", value: 84 }, ...] ordenado desc */
export function toChartData(record, limit) {
  const entries = Object.entries(record || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return limit ? entries.slice(0, limit) : entries
}
