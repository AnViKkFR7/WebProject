import { useEffect, useState } from 'react'
import { leadService } from '../services/leadService'

const REFRESH_MS = 60000

/**
 * Número de solicitudes nuevas de la empresa para el aviso del menú.
 * Se recalcula al cambiar de empresa o de página (p. ej. al salir de Solicitudes tras atenderlas)
 * y cada minuto. Un fallo no muestra nada: el aviso es orientativo y no debe bloquear el menú.
 */
export function useNewLeadsCount(companyId, enabled, refreshKey) {
  const [result, setResult] = useState({ companyId: null, count: 0 })

  useEffect(() => {
    if (!companyId || !enabled) return undefined
    let active = true
    const load = () => leadService.countNew(companyId)
      .then(count => { if (active) setResult({ companyId, count }) })
      .catch(() => { if (active) setResult({ companyId, count: 0 }) })
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => { active = false; window.clearInterval(timer) }
  }, [companyId, enabled, refreshKey])

  // Nunca mostrar el conteo de otra empresa mientras llega el de la actual.
  return enabled && result.companyId === companyId ? result.count : 0
}
