// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({create:vi.fn()}))
vi.mock('../lib/invoicingPdf',()=>({createDocumentPdf:(...args)=>mocks.create(...args)}))
import DocumentPreview from './DocumentPreview'

let root,container
const t=key=>key
const render=async name=>{await act(async()=>root.render(<DocumentPreview invoice={{number:name}} t={t} language="es" kind="invoice"/>))}
const advance=async time=>{await act(async()=>vi.advanceTimersByTime(time))}
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.useFakeTimers()
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
  mocks.create.mockReset().mockImplementation(invoice=>({output:()=>new Blob([invoice.number]),previewPages:[[{type:'text',x:1,y:1,size:4,color:'#000000',value:invoice.number}]]}))
  vi.spyOn(URL,'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
  vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('live PDF preview',()=>{
  it('renders only the selected page and clamps selection when the document shrinks',async()=>{
    mocks.create.mockImplementation(invoice=>({output:()=>new Blob(),previewPages:Array.from({length:invoice.number==='short'?1:3},(_,index)=>[{type:'text',value:`Page ${index+1}`,x:1,y:1,size:4,color:'#000000'}])}))
    await render('long');await advance(200)
    expect(container.querySelectorAll('svg.document-page')).toHaveLength(1)
    expect(container.querySelector('[aria-label="documentPreview.previous"]').disabled).toBe(true)
    await act(async()=>container.querySelector('[aria-label="documentPreview.next"]').click())
    expect(container.querySelector('text').textContent).toBe('Page 2')
    expect(container.querySelectorAll('svg.document-page')).toHaveLength(1)
    await act(async()=>{const select=container.querySelector('select');select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}))})
    expect(container.querySelector('text').textContent).toBe('Page 3')
    expect(container.querySelector('[aria-label="documentPreview.next"]').disabled).toBe(true)
    await render('short');await advance(200)
    expect(container.querySelector('select').value).toBe('0')
    expect(container.querySelector('text').textContent).toBe('Page 1')
  })
  it('generates only the latest input after a typing pause',async()=>{
    await render('old');await advance(100);await render('latest');await advance(199)
    expect(mocks.create).not.toHaveBeenCalled()
    await advance(1)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(container.querySelector('text').textContent).toBe('latest')
  })
  it('keeps the previous PDF link alive until its replacement is ready and cleans both URLs',async()=>{
    await render('first');await advance(200)
    await render('second');await advance(100)
    expect(container.querySelector('a').getAttribute('href')).toBe('blob:first')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await advance(100)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(container.querySelector('a').getAttribute('href')).toBe('blob:second')
    await act(async()=>root.unmount())
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second')
  })
  it('cancels scheduled PDF work when unmounted',async()=>{
    await render('pending');await act(async()=>root.unmount());await advance(500)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('offers a retry when PDF generation fails and recovers without losing the document',async()=>{
    mocks.create.mockImplementationOnce(()=>{throw new Error('temporary failure')})
    await render('recoverable');await advance(200)
    expect(container.querySelector('[role="alert"]')).toBeTruthy()
    await act(async()=>container.querySelector('button').click());await advance(200)
    expect(container.querySelector('text').textContent).toBe('recoverable')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
