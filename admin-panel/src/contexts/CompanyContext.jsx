import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const CompanyContext = createContext()

export const useCompany = () => {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider')
  }
  return context
}

export const CompanyProvider = ({ children }) => {
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener empresas del usuario con su rol
      const { data: memberships, error: membershipsError } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)

      if (membershipsError) throw membershipsError

      const companyIds = memberships.map(m => m.company_id)

      // Obtener datos de las empresas
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)

      if (companiesError) throw companiesError

      // Crear mapa de roles
      const rolesMap = {}
      memberships.forEach(m => {
        rolesMap[m.company_id] = m.role
      })

      // Añadir rol a cada empresa
      const companiesWithRoles = companiesData.map(company => ({
        ...company,
        userRole: rolesMap[company.id]
      }))

      setCompanies(companiesWithRoles)
      
      // Seleccionar primera empresa por defecto
      if (companiesWithRoles.length > 0) {
        setSelectedCompany(companiesWithRoles[0])
      }
    } catch (err) {
      console.error('Error loading companies:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectCompany = (company) => {
    setSelectedCompany(company)
  }

  return (
    <CompanyContext.Provider value={{ 
      selectedCompany, 
      selectCompany, 
      companies, 
      loading 
    }}>
      {children}
    </CompanyContext.Provider>
  )
}
