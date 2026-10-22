// @vitest-environment happy-dom
import {it,expect,vi,afterEach} from 'vitest'
import {downloadInvoice} from './invoicingPdf'
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()})
it.each(['invoice','quote'])('creates and clicks a real Blob download synchronously for %s',kind=>{
  vi.useFakeTimers()
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test-pdf')
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
  let link
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){link={href:this.href,download:this.download,attached:this.isConnected}})
  const invoice={number:'F/0001',status:'draft',document:{issuer:{name:'Marca',taxId:'A',address:'Madrid',logo:'data:image/png;base64,broken'},customer:{name:'Cliente',taxId:'B',address:'Madrid'},date:'2026-10-22',withholding:0,lines:[{description:'Service',quantity:1,price:100,discount:10,tax:21}]}}
  const result=downloadInvoice(invoice,key=>key,'es',kind)
  expect(result).not.toBeInstanceOf(Promise)
  expect(result.blob.type).toBe('application/pdf')
  expect(result.blob.size).toBeGreaterThan(1000)
  expect(create).toHaveBeenCalledWith(result.blob)
  expect(link).toEqual({href:'blob:test-pdf',download:'F_0001.pdf',attached:true})
  expect(document.querySelector('a[download]')).toBeNull()
  expect(revoke).not.toHaveBeenCalled()
  vi.advanceTimersByTime(60000)
  expect(revoke).toHaveBeenCalledWith('blob:test-pdf')
})
