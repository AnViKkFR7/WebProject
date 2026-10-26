import { supabase } from '../lib/supabaseClient'

export const DEFAULT_MODULES = Object.freeze(['items','blog','crm','planning','billing','analytics'])

export const companyModulesService = {
  async get(companyId) {
    const { data, error } = await supabase.from('company_modules').select('module_key,is_enabled')
      .eq('company_id', companyId)
    if (error) throw error
    return data || []
  },

  async setEnabled(companyId, moduleKey, isEnabled) {
    const { data, error } = await supabase.rpc('set_company_module', {
      p_company: companyId,
      p_module_key: moduleKey,
      p_is_enabled: Boolean(isEnabled),
    })
    if (error) throw error
    return data
  },
}
