// xlsx pesa ~430 KB: se descarga solo cuando alguien importa o pide la
// plantilla, no al abrir la pestaña de Atributos.
const loadXLSX = () => import('xlsx')

export const downloadTemplate = async () => {
  const XLSX = await loadXLSX()
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

// A worker isolates parsing and can be terminated even if the parser stalls.
export const importExcel = async (file,onSuccess,onError,{signal}={}) => {
  if(signal?.aborted)return
  if(!/\.(xlsx|xls)$/i.test(file.name)){onError('excelImport.format');return}
  if(!file.size||file.size>2*1024*1024){onError('excelImport.tooLarge');return}
  let worker,timer,done=false
  const finish=(error,definitions)=>{
    if(done)return
    done=true;clearTimeout(timer);worker?.terminate();signal?.removeEventListener('abort',abort)
    if(signal?.aborted)return
    if(error)onError(error);else onSuccess(definitions)
  }
  const abort=()=>finish('excelImport.format')
  signal?.addEventListener('abort',abort,{once:true})
  timer=setTimeout(()=>finish('excelImport.timeout'),10000)
  try{
    const buffer=await file.arrayBuffer()
    if(done)return
    if(buffer.byteLength>2*1024*1024){finish('excelImport.tooLarge');return}
    worker=new Worker(new URL('./excelImport.worker.js',import.meta.url),{type:'module'})
    worker.onmessage=event=>{
      const result=event.data
      if(result?.error)finish(result.error)
      else if(Array.isArray(result?.definitions)&&result.definitions.length>0&&result.definitions.length<=500)finish(null,result.definitions)
      else finish('excelImport.format')
    }
    worker.onerror=()=>finish('excelImport.format')
    worker.onmessageerror=()=>finish('excelImport.format')
    worker.postMessage(buffer,[buffer])
  }catch{finish('excelImport.format')}
}
