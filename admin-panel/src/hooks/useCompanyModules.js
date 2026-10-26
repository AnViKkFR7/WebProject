import { useContext } from 'react'
import { CompanyModulesContext } from '../contexts/companyModules'
import { DEFAULT_MODULES } from '../services/companyModulesService'

export function useCompanyModules() {
  return useContext(CompanyModulesContext) || {
    modules: Object.fromEntries(DEFAULT_MODULES.map(key => [key, true])), loading: false, error: false,
    refresh: async () => {}, setEnabled: async () => {},
  }
}
