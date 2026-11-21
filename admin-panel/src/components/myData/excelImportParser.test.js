import {expect,it} from 'vitest'
import {utils,write,version} from 'xlsx'
import {parseAttributeExcel,MAX_EXCEL_BYTES} from './excelImportParser'
const headers=['Label','Data Type','Filtrable','Requerido']
const file=(rows,bookType='xlsx',edit)=>{
  const workbook=utils.book_new(),sheet=utils.aoa_to_sheet([headers,...rows]);edit?.(sheet)
  utils.book_append_sheet(workbook,sheet,'Attributes')
  return write(workbook,{type:'array',bookType})
}
it('uses the pinned patched SheetJS release and reads real XLSX and XLS files',()=>{
  expect(version).toBe('0.20.3')
  for(const type of ['xlsx','biff8'])expect(parseAttributeExcel(file([['Rooms','integer','SI','NO']],type))).toEqual([{label:'Rooms',data_type:'integer',is_filterable:true,is_required:false}])
})
it('supports the template examples, notes and blank rows without importing them',()=>{
  expect(parseAttributeExcel(file([['Ejemplo: Sample','text','SI','NO'],[],['Label A','text','NO','YES'],['Nota: Help']]))).toEqual([{label:'Label A',data_type:'text',is_filterable:false,is_required:true}])
})
it('rejects malformed containers, oversized files and forged ZIP expansion sizes',()=>{
  expect(()=>parseAttributeExcel(new Uint8Array([1,2,3]).buffer)).toThrow('excelImport.format')
  expect(()=>parseAttributeExcel(new ArrayBuffer(MAX_EXCEL_BYTES+1))).toThrow('excelImport.tooLarge')
  const buffer=file([['A','text']]),view=new DataView(buffer)
  for(let i=0;i<view.byteLength-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,0xffffffff,true);break}
  expect(()=>parseAttributeExcel(buffer)).toThrow('excelImport.limits')
})
it('rejects formulas, wrong types, ambiguous labels and invalid booleans atomically',()=>{
  for(const rows of [[[123,'text']], [['A','unsupported']], [['A','text','MAYBE']], [['A','text'],['a','text']]])expect(()=>parseAttributeExcel(file(rows))).toThrow('excelImport.rows')
  expect(()=>parseAttributeExcel(file([['A','text']], 'xlsx',sheet=>{sheet.A2={t:'s',v:'A',f:'HYPERLINK("https://evil.test","A")'}}))).toThrow('excelImport.rows')
})
it('rejects excessive rows, extra columns and untrusted headers',()=>{
  expect(()=>parseAttributeExcel(file(Array.from({length:501},(_,i)=>['Label '+i,'text'])))).toThrow('excelImport.limits')
  expect(()=>parseAttributeExcel(file([['A','text','','','extra']]))).toThrow('excelImport.limits')
  expect(()=>parseAttributeExcel(file([['A','text']],'xlsx',sheet=>{sheet.A1.v='__proto__'}))).toThrow('excelImport.headers')
  expect({}.polluted).toBeUndefined()
})
it('accepts 500 valid rows and rejects empty workbooks',()=>{
  expect(parseAttributeExcel(file(Array.from({length:500},(_,i)=>['Label '+i,'text'])))).toHaveLength(500)
  expect(()=>parseAttributeExcel(file([]))).toThrow('excelImport.empty')
})
