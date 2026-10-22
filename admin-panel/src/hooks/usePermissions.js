import { useMemo } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { permissionsFor } from '../lib/permissions'

/** Permisos del usuario en la empresa seleccionada. */
export function usePermissions() {
  const { selectedCompany, isPlatformAdmin } = useCompany()
  const role = selectedCompany?.userRole
  return useMemo(() => permissionsFor(role, isPlatformAdmin), [role, isPlatformAdmin])
}
