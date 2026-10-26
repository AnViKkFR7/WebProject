import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCompany } from './CompanyContext'
import { companyModulesService, DEFAULT_MODULES } from '../services/companyModulesService'
import { CompanyModulesContext } from './companyModules'

export function CompanyModulesProvider({ children }) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const [modules, setModules] = useState(() => Object.fromEntries(DEFAULT_MODULES.map(key => [key, true])))
  const [loading, setLoading] = useState(Boolean(companyId))
  const [error, setError] = useState(false)
  const [loadedCompanyId, setLoadedCompanyId] = useState(null)
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    if (!companyId) {
      setModules(Object.fromEntries(DEFAULT_MODULES.map(key => [key, true])))
      setLoadedCompanyId(null)
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    try {
      const rows = await companyModulesService.get(companyId)
      if (currentRequest !== requestId.current) return
      const next = Object.fromEntries(DEFAULT_MODULES.map(key => [key, true]))
      for (const row of rows) if (keyExists(row.module_key)) next[row.module_key] = row.is_enabled
      setModules(next)
      setLoadedCompanyId(companyId)
      setError(false)
    } catch {
      // Fail closed until the current company's module settings are readable.
      if (currentRequest !== requestId.current) return
      setModules(Object.fromEntries(DEFAULT_MODULES.map(key => [key, false])))
      setLoadedCompanyId(companyId)
      setError(true)
    } finally { if (currentRequest === requestId.current) setLoading(false) }
  }, [companyId])

  useEffect(() => { refresh() }, [refresh])

  const setEnabled = useCallback(async (moduleKey, enabled) => {
    if (!companyId || !keyExists(moduleKey)) throw new Error('Invalid company module')
    await companyModulesService.setEnabled(companyId, moduleKey, enabled)
    await refresh()
  }, [companyId, refresh])

  const companyLoading = loading || Boolean(companyId && loadedCompanyId !== companyId)
  const value = useMemo(() => ({ modules, loading: companyLoading, error, refresh, setEnabled }), [modules, companyLoading, error, refresh, setEnabled])
  return <CompanyModulesContext.Provider value={value}>{children}</CompanyModulesContext.Provider>
}

function keyExists(key) { return DEFAULT_MODULES.includes(key) }

