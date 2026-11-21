import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {importExcel,downloadTemplate} from './excelUtils'
import {utils,write,writeFile} from 'xlsx'
import {parseAttributeExcel} from './excelImportParser'
vi.mock('xlsx',async original=>({...await original(),writeFile:vi.fn()}))
let workers
const file=()=>({name:'test.xlsx',size:10,arrayBuffer:async()=>new ArrayBuffer(10)})
beforeEach(()=>{
  workers=[]
  vi.stubGlobal('Worker',class {
    constructor(){workers.push(this);this.terminate=vi.fn();this.postMessage=vi.fn()}
  })
})
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
it('rejects file metadata before reading or starting a worker',async()=>{
  for(const fields of [{name:'test.csv'},{size:3*1024*1024},{size:0}]){
    const input={...file(),...fields},read=vi.fn(input.arrayBuffer),error=vi.fn()
    await importExcel({...input,arrayBuffer:read},vi.fn(),error)
    expect(error).toHaveBeenCalled();expect(read).not.toHaveBeenCalled()
  }
  expect(workers).toHaveLength(0)
})
it('transfers bytes to a worker and terminates it after a successful result',async()=>{
  const success=vi.fn(),error=vi.fn()
  await importExcel(file(),success,error)
  const worker=workers[0],definitions=[{label:'A',data_type:'text'}]
  expect(worker.postMessage).toHaveBeenCalledWith(expect.any(ArrayBuffer),[expect.any(ArrayBuffer)])
  worker.onmessage({data:{definitions}})
  expect(success).toHaveBeenCalledWith(definitions);expect(error).not.toHaveBeenCalled();expect(worker.terminate).toHaveBeenCalled()
})
it('terminates a stalled parser and reports a timeout only once',async()=>{
  vi.useFakeTimers();const error=vi.fn(),success=vi.fn()
  await importExcel(file(),success,error);await vi.advanceTimersByTimeAsync(10000)
  expect(error).toHaveBeenCalledExactlyOnceWith('excelImport.timeout');expect(workers[0].terminate).toHaveBeenCalled()
  workers[0].onmessage({data:{definitions:[{}]}});expect(success).not.toHaveBeenCalled()
})
it('aborts silently so a stale company or closed editor never receives results',async()=>{
  const controller=new AbortController(),success=vi.fn(),error=vi.fn()
  await importExcel(file(),success,error,{signal:controller.signal});controller.abort()
  workers[0].onmessage({data:{definitions:[{}]}})
  expect(success).not.toHaveBeenCalled();expect(error).not.toHaveBeenCalled();expect(workers[0].terminate).toHaveBeenCalled()
})
it('reports read and worker failures without committing partial results',async()=>{
  const error=vi.fn(),success=vi.fn()
  await importExcel({...file(),arrayBuffer:async()=>{throw new Error('read failed')}},success,error)
  expect(error).toHaveBeenCalledWith('excelImport.format')
  await importExcel(file(),success,error);workers[0].onerror()
  expect(success).not.toHaveBeenCalled();expect(workers[0].terminate).toHaveBeenCalled()
})
it('exports the existing template and can import a completed copy using the real parser',async()=>{
  await downloadTemplate()
  expect(writeFile).toHaveBeenCalledWith(expect.any(Object),'plantilla_atributos.xlsx')
  const workbook=writeFile.mock.calls.at(-1)[0]
  utils.sheet_add_aoa(workbook.Sheets.Atributos,[['Real attribute','text','SI','NO']],{origin:'A2'})
  expect(parseAttributeExcel(write(workbook,{type:'array',bookType:'xlsx'}))).toEqual([{label:'Real attribute',data_type:'text',is_filterable:true,is_required:false}])
})
