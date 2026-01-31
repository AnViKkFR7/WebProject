import * as XLSX from 'xlsx'

export const downloadTemplate = () => {
  // Crear plantilla Excel con headers
  const headers = [['Label', 'Data Type', 'Filtrable', 'Requerido']]
  const examples = [
    ['Ejemplo: Número de habitaciones', 'integer', 'SI', 'NO'],
    ['Ejemplo: Descripción', 'longtext', 'NO', 'SI']
  ]
  
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...examples])
  
  // Añadir validación de datos (selectores) a las columnas
  if (!ws['!dataValidation']) ws['!dataValidation'] = []
  
  // Data Type validation (columna B, desde fila 2 hasta 100)
  ws['!dataValidation'].push({
    sqref: 'B2:B100',
    type: 'list',
    allowBlank: false,
    formula1: '"text,longtext,integer,decimal,boolean,date,text_array,number_array"'
  })
  
  // Filtrable validation (columna C)
  ws['!dataValidation'].push({
    sqref: 'C2:C100',
    type: 'list',
    allowBlank: false,
    formula1: '"SI,NO"'
  })
  
  // Requerido validation (columna D)
  ws['!dataValidation'].push({
    sqref: 'D2:D100',
    type: 'list',
    allowBlank: false,
    formula1: '"SI,NO"'
  })
  
  // Ajustar anchos de columna
  ws['!cols'] = [
    { wch: 35 }, // Label
    { wch: 15 }, // Data Type
    { wch: 12 }, // Filtrable
    { wch: 12 }  // Requerido
  ]
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Atributos')
  
  // Añadir nota informativa en fila separada
  const validTypes = 'Nota: Las columnas Data Type, Filtrable y Requerido tienen selectores desplegables'
  XLSX.utils.sheet_add_aoa(ws, [[], [validTypes]], { origin: -1 })
  
  XLSX.writeFile(wb, 'plantilla_atributos.xlsx')
}

export const importExcel = (file, onSuccess, onError) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Mapear datos del Excel a formato de definiciones
      const importedDefinitions = jsonData
        .filter(row => row['Label'] && !row['Label'].startsWith('Ejemplo:'))
        .map(row => ({
          label: row['Label'] || '',
          data_type: (row['Data Type'] || 'text').toLowerCase(),
          is_filterable: (row['Filtrable'] || '').toUpperCase() === 'SI',
          is_required: (row['Requerido'] || '').toUpperCase() === 'SI'
        }))

      if (importedDefinitions.length === 0) {
        onError('No se encontraron atributos válidos en el archivo')
        return
      }

      onSuccess(importedDefinitions)
    } catch (err) {
      console.error('Error importing Excel:', err)
      onError('Error al leer el archivo Excel. Verifica que el formato sea correcto.')
    }
  }
  reader.readAsArrayBuffer(file)
}
