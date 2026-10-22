import { useCallback, useState } from 'react'
import { importExcel } from '../components/myData/excelUtils'

const emptyRow = () => ({ label: '', data_type: 'text', is_filterable: false, is_required: false })

/**
 * Filas de la creación en lote (nuevo tipo de item o importación Excel).
 * Siempre hay una fila vacía al final para seguir escribiendo.
 */
export function useDefinitionDraft({ onImported, onImportError } = {}) {
  const [rows, setRows] = useState([emptyRow()])

  const change = useCallback((index, field, value) => {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      const current = next[index]
      const hasData = current.label || current.data_type !== 'text' || current.is_filterable || current.is_required
      return hasData && index === next.length - 1 ? [...next, emptyRow()] : next
    })
  }, [])

  const remove = useCallback((index) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }, [])

  const reset = useCallback(() => setRows([emptyRow()]), [])

  const importFile = useCallback((event) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    importExcel(
      file,
      (imported) => {
        setRows([...imported, emptyRow()])
        onImported?.(imported.length)
      },
      (message) => onImportError?.(message),
    )
  }, [onImported, onImportError])

  const validRows = rows.filter((row) => row.label.trim() !== '')

  return { rows, validRows, change, remove, reset, importFile }
}
