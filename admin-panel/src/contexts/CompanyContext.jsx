import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isPlatformAdminUser } from '../lib/permissions'

const CompanyContext = createContext()

// eslint-disable-next-line react-refresh/only-export-components -- El hook consume el contexto definido junto a su proveedor.
export const useCompany = () => {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider')
  }
  return context
}

// Por usuario: dos personas en el mismo navegador no se pisan la elección
const storageKey = (userId) => `moira.selectedCompany.${userId}`

function readStoredId(userId) {
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

function storeId(userId, companyId) {
  try {
    localStorage.setItem(storageKey(userId), companyId)
  } catch {
    // Almacenamiento bloqueado (modo privado, etc.): la elección dura la sesión
  }
}

export const CompanyProvider = ({ children }) => {
  const requestId = useRef(0)
  const authUserId = useRef(null)
  const invalidateRequests = useCallback(() => { requestId.current += 1 }, [])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [companies, setCompanies] = useState([])
  const [userId, setUserId] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadCompanies = useCallback(async () => {
    const request = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (request !== requestId.current) return
      if (!user) {
        authUserId.current = null
        setUser(null); setUserId(null); setCompanies([]); setSelectedCompany(null)
        return
      }
      authUserId.current = user.id
      setUserId(user.id)
      setUser(user)

      const { data: memberships, error: membershipsError } = await supabase
        .from('company_members')
        .select('company_id, role, full_name')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (request !== requestId.current) return
      if (membershipsError) throw membershipsError

      const companyIds = memberships.map((m) => m.company_id)
      if (companyIds.length === 0) {
        setCompanies([])
        setSelectedCompany(null)
        return
      }

      // Sin order by, Postgres no garantiza el orden: antes "la primera
      // empresa" podía ser una distinta en cada refresco.
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)
        .order('name', { ascending: true })

      if (request !== requestId.current) return
      if (companiesError) throw companiesError

      const membershipMap = Object.fromEntries(memberships.map((m) => [m.company_id, m]))
      const companiesWithRoles = companiesData.map((company) => ({
        ...company,
        userRole: membershipMap[company.id]?.role,
        memberName: membershipMap[company.id]?.full_name || null,
      }))

      setCompanies(companiesWithRoles)

      const storedId = readStoredId(user.id)
      const restored = companiesWithRoles.find((c) => c.id === storedId)
      setSelectedCompany(restored || companiesWithRoles[0])
    } catch (err) {
      console.error('Error loading companies:', err)
      if (request === requestId.current) { setError(err); setCompanies([]); setSelectedCompany(null) }
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCompanies()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id || null
      if (authUserId.current === nextUserId) { setUser(session?.user || null); return }
      authUserId.current = nextUserId
      ++requestId.current
      setUser(session?.user || null); setUserId(nextUserId)
      setCompanies([]); setSelectedCompany(null); setError(null)
      setLoading(Boolean(nextUserId))
      // El callback de Auth no debe esperar otras llamadas de Supabase.
      if (nextUserId) queueMicrotask(() => loadCompanies())
    })
    return () => { invalidateRequests(); subscription.unsubscribe() }
  }, [loadCompanies, invalidateRequests])

  const selectCompany = useCallback((company) => {
    setSelectedCompany(company)
    if (userId && company?.id) storeId(userId, company.id)
  }, [userId])

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      selectCompany,
      companies,
      user,
      isPlatformAdmin: isPlatformAdminUser(user),
      loading,
      error,
      reload: loadCompanies,
    }}>
      {children}
    </CompanyContext.Provider>
  )
}
