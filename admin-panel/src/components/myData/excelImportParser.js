import {read,utils} from 'xlsx'

export const MAX_EXCEL_BYTES=2*1024*1024
const fail=code=>{throw new Error(`excelImport.${code}`)}
// Inspect ZIP directory before inflation. XLSX is ZIP; XLS uses an OLE container.
function checkContainer(bytes){
  if(bytes.length>MAX_EXCEL_BYTES)fail('tooLarge')
  if([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((n,i)=>bytes[i]===n))return
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  let end=-1
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))fail('format')
  const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),start=view.getUint32(end+16,true)
  if(!count||count>128||size===0xffffffff||start+size>end)fail('limits')
  let offset=start,total=0
  for(let i=0;i<count;i++){
    if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)fail('format')
    const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true)
    const compressed=view.getUint32(offset+20,true),expanded=view.getUint32(offset+24,true)
    total+=expanded
    if(flags&1||![0,8].includes(method)||total>8*1024*1024||expanded>Math.max(compressed,1)*200)fail('limits')
    offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true)
  }
  if(offset!==start+size)fail('format')
}
const boolean=value=>{
  const text=String(value??'').trim().toUpperCase()
  if(['SI','SÍ','YES','TRUE'].includes(text))return true
  if(['','NO','FALSE'].includes(text))return false
  fail('rows')
}
export function parseAttributeExcel(buffer){
  const bytes=new Uint8Array(buffer);checkContainer(bytes)
  const workbook=read(bytes,{type:'array',sheets:0,sheetRows:506,cellFormula:true,cellHTML:false,cellStyles:false,bookVBA:false,bookDeps:false})
  const sheet=workbook.Sheets[workbook.SheetNames[0]]
  if(!sheet||!sheet['!ref'])fail('empty')
  const range=utils.decode_range(sheet['!fullref']||sheet['!ref'])
  if(range.e.r>=505||range.e.c>3||range.s.r!==0||range.s.c!==0)fail('limits')
  for(let r=0;r<=range.e.r;r++)for(let c=0;c<4;c++)if(sheet[utils.encode_cell({r,c})]?.f)fail('rows')
  const rows=utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:false})
  const headers=rows.shift()
  if(!headers||['label','data type','filtrable','requerido'].some((value,i)=>String(headers[i]).trim().toLowerCase()!==value))fail('headers')
  const types=new Set(['text','longtext','integer','decimal','boolean','date','text_array','number_array'])
  const labels=new Set(),result=[]
  for(const row of rows){
    if(row.every(value=>value===''))continue
    if(typeof row[0]!=='string')fail('rows')
    const label=row[0].trim()
    if(/^(Ejemplo:|Example:)/i.test(label)||(/^Nota:/i.test(label)&&row.slice(1).every(value=>value==='')))continue
    if(row[1]!==''&&typeof row[1]!=='string')fail('rows')
    const type=typeof row[1]==='string'?row[1].trim().toLowerCase():''
    if(!label||label.length>200||[...label].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)||!types.has(type||'text')||labels.has(label.toLowerCase()))fail('rows')
    labels.add(label.toLowerCase())
    result.push({label,data_type:type||'text',is_filterable:boolean(row[2]),is_required:boolean(row[3])})
    if(result.length>500)fail('limits')
  }
  if(!result.length)fail('empty')
  return result
}
