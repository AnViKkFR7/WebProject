// @vitest-environment happy-dom
import { act, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../locales/es'
import { emptyProfile } from '../lib/invoicing'
import { billingPalettes } from '../lib/billingAppearance'
import {clearDraftRecovery} from '../lib/documentDrafts'
const mocks = vi.hoisted(() => ({ company:null,canEdit:true,readLogo:vi.fn(),download:vi.fn(),load:vi.fn(),saveProfile:vi.fn(),saveInvoice:vi.fn(),convert:vi.fn(),confirm:vi.fn(),toast:{ success:vi.fn(),error:vi.fn() } }))
const paletteMocks=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
const draftMocks=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),remove:vi.fn()}))
const templateMocks=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),archive:vi.fn()}))
vi.mock('../services/documentDraftService',()=>({loadDocumentDraft:(...args)=>draftMocks.load(...args),saveDocumentDraft:(...args)=>draftMocks.save(...args),deleteDocumentDraft:(...args)=>draftMocks.remove(...args)}))
vi.mock('../services/billingReuseService',()=>({loadBillingReuse:async()=>({clients:[],catalog:[]}),saveBillingClient:vi.fn(),saveBillingCatalogItem:vi.fn(),archiveBillingCatalogItem:vi.fn()}))
vi.mock('../services/billingTemplateService',()=>({loadBillingChapterTemplates:(...args)=>templateMocks.load(...args),saveBillingChapterTemplate:(...args)=>templateMocks.save(...args),archiveBillingChapterTemplate:(...args)=>templateMocks.archive(...args)}))
vi.mock('../services/billingFinanceService',()=>({loadInvoiceFinancials:async()=>[],loadBillingFinanceDetail:async()=>({payments:[],history:[],historyHasMore:false}),loadBillingHistoryPage:async()=>({history:[],historyHasMore:false}),loadBillingDueReminderSettings:async company_id=>({company_id,enabled:false,offsets_days:[7,1,0,-7],local_send_time:'09:00:00',timezone:'Europe/Madrid'}),saveBillingDueReminderSettings:vi.fn(),loadBillingDueReminderFailures:async()=>[],retryBillingDueReminder:vi.fn(),loadInvoiceDueReminderPreference:async(company_id,invoice_id)=>({company_id,invoice_id,suppressed:false}),setInvoiceDueReminders:vi.fn(),registerInvoicePayment:vi.fn(),reverseInvoicePayment:vi.fn(),restoreBillingDraftVersion:vi.fn()}))
vi.mock('../services/billingPaletteService',()=>({loadBillingPalettes:(...args)=>paletteMocks.load(...args),saveBillingPalette:(...args)=>paletteMocks.save(...args)}))
vi.mock('../components/DocumentPreview',()=>({default:({invoice})=><div data-preview>{invoice.document.customer.name}</div>}))
vi.mock('../lib/billingLogo',()=>({readBillingLogo:(...args)=>mocks.readLogo(...args)}))
vi.mock('../lib/invoicingPdf',()=>({downloadInvoice:(...args)=>mocks.download(...args)}))
vi.mock('../contexts/CompanyContext',()=>({ useCompany:()=>({ selectedCompany:mocks.company,user:{ id:'user' } }) }))
vi.mock('../hooks/usePermissions',()=>({ usePermissions:()=>({ canEdit:mocks.canEdit }) }))
vi.mock('../contexts/FeedbackContext',()=>({ useFeedback:()=>({ toast:mocks.toast,confirm:mocks.confirm }) }))
vi.mock('../contexts/LanguageContext',()=>({ useLanguage:()=>({ language:'es',t:key=>key.split('.').reduce((value,k)=>value?.[k],es) || key }) }))
vi.mock('../services/invoicingService',()=>({ loadInvoicing:(...args)=>mocks.load(...args),saveProfile:(...args)=>mocks.saveProfile(...args),saveInvoice:(...args)=>mocks.saveInvoice(...args),convertQuote:(...args)=>mocks.convert(...args) }))
vi.mock('../components/ui/Modal',()=>({ default:({ open,title,footer,children })=>open ? <div role="dialog"><h3>{title}</h3>{children}<footer>{footer}</footer></div> : null }))
import Invoicing from './Invoicing'
let container; let root; let router; let currentKind; let refresh
function TestWorkspace({kind}) { const [revision,setRevision]=useState(0);useEffect(()=>{refresh=()=>setRevision(value=>value+1)},[]);return <Invoicing kind={kind} revision={revision}/> }
const savedProfile = { ...emptyProfile,name:'Company A',taxId:'A123',address:'Madrid' }
const render = async (kind = 'invoice', entry) => {
  if (!router || currentKind !== kind) {
    currentKind = kind
    router=createMemoryRouter([{path:kind==='quote'?'/quotes/*':'/invoicing/*',element:<TestWorkspace kind={kind}/>},{path:'/other',element:<p>Other</p>}],{initialEntries:[entry || (kind==='quote'?'/quotes':'/invoicing')]})
  }
  await act(async()=>{root.render(<RouterProvider router={router}/>);refresh?.()})
}
const button = name => [...container.querySelectorAll('button')].find(b=>b.textContent===name)
const click = async element => { expect(element).toBeTruthy(); await act(async()=>element.click()) }
const issuerSection = () => container.querySelector('.invoice-issuer-section')
beforeEach(()=>{
  sessionStorage.clear()
  draftMocks.load.mockReset().mockResolvedValue(null);draftMocks.remove.mockReset().mockResolvedValue()
  templateMocks.load.mockReset().mockResolvedValue([]);templateMocks.save.mockReset();templateMocks.archive.mockReset()
  draftMocks.save.mockReset().mockImplementation(async(scope,document,baseVersion,version,writeId)=>({id:'draft-id',company_id:scope.companyId,owner_id:scope.userId,kind:scope.kind,document_key:scope.key,document,base_version:baseVersion,version:version+1,last_write:writeId}))
  paletteMocks.load.mockReset().mockResolvedValue([]);paletteMocks.save.mockReset()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  router=null;currentKind=null;refresh=null
  mocks.company={ id:'company-a',name:'Company A' }; mocks.canEdit=true
  mocks.load.mockReset().mockResolvedValue({ invoices:[],profile:savedProfile,profileVersion:3 })
  mocks.download.mockReset();mocks.readLogo.mockReset()
  mocks.saveProfile.mockReset().mockResolvedValue(4); mocks.saveInvoice.mockReset(); mocks.convert.mockReset(); mocks.confirm.mockReset()
  container=document.createElement('div'); document.body.append(container); root=createRoot(container)
})
afterEach(async()=>{ await act(async()=>root.unmount());container.remove();sessionStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals() })
describe('issuer forms and tenant switching',()=>{
  it.each(['invoice','quote'])('hides the saved issuer form and restores it with the switch (%s)',async kind=>{
    await render(kind);await click(button(kind==='quote'?'Nuevo presupuesto':'Nueva factura'))
    const toggle=issuerSection().querySelector('[role="switch"]')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(issuerSection().querySelectorAll('input')).toHaveLength(0)
    await click(toggle)
    expect(issuerSection().querySelectorAll('input').length).toBeGreaterThan(0)
    expect(button('Guardar datos de facturación del emisor')).toBeTruthy()
    await click(toggle)
    expect(issuerSection().querySelectorAll('input')).toHaveLength(0)
  })
  it('shows missing issuer details and does not save the incomplete profile',async()=>{
    mocks.load.mockResolvedValue({ invoices:[],profile:null,profileVersion:0 })
    await render();await click(button('Nueva factura'))
    expect(issuerSection().querySelector('[role="switch"]').disabled).toBe(true)
    await click(button('Guardar datos de facturación del emisor'))
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })
  it('saves just the issuer without requiring customer details',async()=>{
    await render();await click(button('Nueva factura'));await click(issuerSection().querySelector('[role="switch"]'))
    await click(button('Guardar datos de facturación del emisor'))
    expect(mocks.saveProfile).toHaveBeenCalledWith('company-a',expect.objectContaining({ taxId:'A123' }),3)
    expect(issuerSection().querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })
  it('unmounts the document editor when changing company',async()=>{
    await render();await click(button('Nueva factura'))
    expect(container.querySelector('[aria-label="Editor de documento"]')).toBeTruthy()
    mocks.company={ id:'company-b',name:'Company B' }
    mocks.load.mockResolvedValue({ invoices:[],profile:{ ...savedProfile,name:'Company B',taxId:'B456' },profileVersion:1 })
    await render()
    expect(container.textContent).not.toContain('A123')
    expect(container.textContent).not.toContain('A123')
    expect(mocks.load).toHaveBeenLastCalledWith('company-b','invoice')
  })
  it('discards a pending confirmation after changing companies',async()=>{
    const quote={ id:'q1',number:'P-000001',version:1,status:'accepted',document:{ issuer:savedProfile,customer:{ name:'Client',taxId:'C789',address:'City' },date:'2026-10-22',dueDate:'',withholding:0,lines:[{ description:'Service',quantity:1,price:100,discount:0,tax:21 }] } }
    mocks.load.mockResolvedValue({ invoices:[quote],profile:savedProfile,profileVersion:3 })
    let resolve
    mocks.confirm.mockImplementation(()=>new Promise(done=>{ resolve=done }))
    await render('quote');await click(button('P-000001'));await click(button('Convertir en factura'))
    expect(mocks.confirm).toHaveBeenCalled()
    mocks.company={ id:'company-b',name:'Company B' };mocks.load.mockResolvedValue({ invoices:[],profile:savedProfile,profileVersion:1 })
    await render('quote')
    await act(async()=>resolve(true))
    expect(mocks.convert).not.toHaveBeenCalled()
  })
  it('does not offer document creation to viewers',async()=>{
    mocks.canEdit=false;await render()
    expect(button('Nueva factura')).toBeUndefined()
  })
  it('downloads the current edited document as a draft without requiring a save',async()=>{
    const record={id:'i1',number:'F260001',version:1,status:'issued',document:{issuer:savedProfile,customer:{name:'Client',taxId:'C789',address:'City'},date:'2026-10-22',withholding:0,lines:[{description:'Service',quantity:1,price:100,discount:0,tax:21}]}}
    mocks.load.mockResolvedValue({invoices:[record],profile:savedProfile,profileVersion:1})
    await render();await click(button('F260001'))
    const quantity=container.querySelector('[data-field="quantity"] input')
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(quantity,'2');quantity.dispatchEvent(new Event('input',{bubbles:true}));quantity.dispatchEvent(new Event('change',{bubbles:true}))})
    expect(button('Descargar PDF').disabled).toBe(false)
    await click(button('Descargar PDF'))
    expect(mocks.download).toHaveBeenCalledWith(expect.objectContaining({status:'draft',document:expect.objectContaining({lines:[expect.objectContaining({quantity:'2'})]})}),expect.any(Function),'es','invoice')
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })

})

const record = () => ({id:'i1',company_id:'company-a',number:'F260001',version:1,status:'draft',document:{issuer:savedProfile,customer:{name:'Client',taxId:'C789',address:'City',email:''},date:'2026-10-22',dueDate:'',withholding:0,lines:[{description:'Service',quantity:1,price:100,discount:0,tax:21}]}})

it('makes issued invoices read-only, removes the cancel action, and explains the rectification limit',async()=>{
  const invoice=record();invoice.status='issued'
  mocks.load.mockResolvedValue({invoices:[invoice],profile:savedProfile,profileVersion:3})
  await render('invoice','/invoicing/i1')
  expect(container.querySelector('#invoice-editor fieldset').disabled).toBe(true)
  expect(container.textContent).toContain(es.invoicing.issuedImmutable)
  expect(button(es.invoicing.cancelInvoice)).toBeUndefined()
  const statusSelect=[...container.querySelectorAll('#invoice-editor select')].find(select=>[...select.options].some(option=>option.value==='issued'))
  expect(statusSelect).toBeTruthy()
  expect([...statusSelect.options].map(option=>option.value)).toEqual(['issued'])
})
const input = async (element,value) => { await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))}) }
const submit = async () => {await act(async()=>container.querySelector('#invoice-editor').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))}
describe('full page document navigation',()=>{
  it.each(['invoice','quote'])('duplicates a saved %s into an unnumbered draft and requires new dates',async kind=>{
    const source=record();source.status=kind==='quote'?'sent':'issued';source.document.date='2026-10-20';source.document.dueDate='2026-11-20'
    mocks.load.mockResolvedValue({invoices:[source],profile:savedProfile,profileVersion:1})
    await render(kind);await click(button(source.number));await click(button(kind==='quote'?'Duplicar presupuesto':'Duplicar factura'))
    expect(router.state.location.pathname).toBe(kind==='quote'?'/quotes/new':'/invoicing/new')
    expect(container.querySelector('[data-field="date"] input').value).toBe('')
    expect(container.querySelector('[data-field="dueDate"] input').value).toBe('')
    expect(container.textContent).toContain(`Copia de ${source.number}`)
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })
  it('opens a direct document URL after loading tenant-scoped data',async()=>{
    mocks.load.mockResolvedValue({invoices:[record()],profile:savedProfile,profileVersion:1})
    await render('invoice','/invoicing/i1')
    expect(container.querySelector('h1').textContent).toBe('F260001')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('#invoice-editor')).toBeTruthy()
  })
  it('does not expose another company document through a guessed URL',async()=>{
    await render('invoice','/invoicing/foreign-id')
    expect(container.querySelector('#invoice-editor')).toBeNull()
    expect(container.textContent).toContain(es.documentWorkspace.unavailable)
    expect(mocks.load).toHaveBeenCalledWith('company-a','invoice')
  })
  it('does not open the new route for a viewer',async()=>{
    mocks.canEdit=false;await render('invoice','/invoicing/new')
    expect(container.querySelector('#invoice-editor')).toBeNull()
  })
  it('preserves list filters when returning from an unchanged document',async()=>{
    mocks.load.mockResolvedValue({invoices:[record()],profile:savedProfile,profileVersion:1})
    await render('invoice','/invoicing?q=Client&status=draft')
    await click(button('F260001'));expect(router.state.location.pathname).toBe('/invoicing/i1')
    await click(button(es.documentWorkspace.back))
    expect(container.querySelector('input[type="search"]').value).toBe('Client')
    expect(router.state.location.search).toBe('?q=Client&status=draft')
  })
  it('restores the list scroll position after closing the editor',async()=>{
    mocks.load.mockResolvedValue({invoices:[record()],profile:savedProfile,profileVersion:1})
    const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
    await render()
    vi.spyOn(window,'scrollY','get').mockReturnValue(640)
    await click(button('F260001'));await click(button(es.documentWorkspace.back))
    expect(scroll).toHaveBeenLastCalledWith(0,640)
    scroll.mockRestore()
  })
  it('keeps input when leaving is declined and discards it only after confirmation',async()=>{
    await render();await click(button('Nueva factura'))
    await input(container.querySelector('[data-field="name"] input'),'Unsaved client')
    mocks.confirm.mockResolvedValue(false)
    await click(button(es.documentWorkspace.back))
    expect(router.state.location.pathname).toBe('/invoicing/new')
    expect(container.querySelector('[data-field="name"] input').value).toBe('Unsaved client')
    mocks.confirm.mockResolvedValue(true)
    await click(button(es.documentWorkspace.back))
    expect(router.state.location.pathname).toBe('/invoicing')
    expect(container.querySelector('#invoice-editor')).toBeNull()
  })
  it('guards browser back and navigation to another panel page',async()=>{
    await render();await click(button('Nueva factura'))
    await input(container.querySelector('[data-field="name"] input'),'Unsaved')
    mocks.confirm.mockResolvedValue(false)
    await act(async()=>router.navigate(-1))
    expect(router.state.location.pathname).toBe('/invoicing/new')
    await act(async()=>router.navigate('/other'))
    expect(router.state.location.pathname).toBe('/invoicing/new')
    expect(mocks.confirm).toHaveBeenCalledTimes(2)
  })
  it('preserves input on save failure and returns without a discard prompt after a successful retry',async()=>{
    mocks.load.mockResolvedValue({invoices:[record()],profile:savedProfile,profileVersion:1})
    await render('invoice','/invoicing/i1')
    await input(container.querySelector('[data-field="quantity"] input'),'2')
    // Happy DOM uses floating-point remainder for fractional steps (e.g. 100 % .01).
    // Native browser constraints and decimal business validation are verified separately.
    container.querySelectorAll('input[type=number]').forEach(control=>{control.step='any'})
    mocks.saveInvoice.mockRejectedValueOnce(new Error('offline'))
    await submit()
    expect(container.querySelector('[data-field="quantity"] input').value).toBe('2')
    expect(container.textContent).toContain(es.invoicing.saveError)
    mocks.saveInvoice.mockResolvedValue({...record(),version:2})
    await submit()
    expect(router.state.location.pathname).toBe('/invoicing')
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it('shows field errors, focuses the first invalid field and never submits an incomplete document',async()=>{
    await render();await click(button('Nueva factura'))
    await submit()
    const first=container.querySelector('[data-field="name"] input')
    expect(first.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(first)
    expect(container.querySelectorAll('.field-error').length).toBeGreaterThan(1)
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })
  it('keeps the same form and values while switching between editing and preview',async()=>{
    await render();await click(button('Nueva factura'))
    const form=container.querySelector('#invoice-editor')
    await input(container.querySelector('[data-field="name"] input'),'Preview client')
    await click(button('Vista previa'));await click(button('Editar'))
    expect(container.querySelector('#invoice-editor')).toBe(form)
    expect(container.querySelector('[data-field="name"] input').value).toBe('Preview client')
  })
  it('warns on reload only when there are unsaved changes',async()=>{
    await render();await click(button('Nueva factura'))
    const clean=new Event('beforeunload',{cancelable:true});window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    await input(container.querySelector('[data-field="name"] input'),'Pending')
    const dirty=new Event('beforeunload',{cancelable:true});window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })
})

const paletteButton=(scope,name)=>[...scope.querySelectorAll('button')].find(item=>item.querySelector('strong')?.textContent===name)
const savedPaletteSelect=()=>container.querySelector(`select[aria-label="${es.namedPalettes.select}"]`)
const chooseSavedPalette=async id=>{await act(async()=>{savedPaletteSelect().value=id;savedPaletteSelect().dispatchEvent(new Event('change',{bubbles:true}))})}
describe('document summary and brand snapshots',()=>{
  it.each(['invoice','quote'])('offers recovery of an incomplete %s before editing and never restores an issued status',async kind=>{
    const restored={...record().document,customer:{name:'Recovered client',taxId:'',address:'',email:''},lines:[{description:'Pending',quantity:'',price:0,discount:0,tax:21}]}
    draftMocks.load.mockResolvedValue({id:'draft',version:2,base_version:null,document:restored})
    await render(kind);await click(button(kind==='quote'?'Nuevo presupuesto':'Nueva factura'))
    expect(button(es.documentAutosave.recoverRemote)).toBeTruthy()
    await click(button(es.documentAutosave.recoverRemote))
    expect(container.querySelector('[data-field="name"] input').value).toBe('Recovered client')
    expect(container.querySelector('.document-metadata-grid select').value).toBe('draft')
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })

  it('clears recovery on logout and prevents unmount cleanup from writing it back',async()=>{
    await render();await click(button('Nueva factura'))
    await input(container.querySelector('[data-field="name"] input'),'Private draft')
    window.dispatchEvent(new Event('beforeunload',{cancelable:true}))
    expect(sessionStorage.length).toBeGreaterThan(0)
    clearDraftRecovery()
    expect(sessionStorage.length).toBe(0)
    await act(async()=>root.unmount());container.remove()
    expect(sessionStorage.length).toBe(0)
    root=createRoot(container);document.body.append(container)
  })
  it.each(['invoice','quote'])('shows a saved palette selector before custom colors and applies a loaded palette (%s)',async kind=>{
    const palette={...billingPalettes[1],id:'custom'}
    const logo='data:image/png;base64,iVBORw0KGgo='
    mocks.load.mockResolvedValue({invoices:[],profile:{...savedProfile,logo},profileVersion:3})
    paletteMocks.load.mockResolvedValue([{id:'ocean-saved',company_id:'company-a',name:'Mar guardado',palette}])
    await render(kind);await click(button(kind==='quote'?'Nuevo presupuesto':'Nueva factura'))
    const appearance=container.querySelector('.document-appearance-details')
    expect(savedPaletteSelect()).toBeTruthy()
    expect(savedPaletteSelect().disabled).toBe(false)
    expect([...savedPaletteSelect().options].map(option=>option.textContent)).toContain('Mar guardado')
    await chooseSavedPalette('ocean-saved')
    expect(savedPaletteSelect().value).toBe('ocean-saved')
    const custom=appearance.querySelector('.color-selector').parentElement
    expect(savedPaletteSelect().compareDocumentPosition(custom)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(appearance.querySelector('.color-selector input').value).toBe(palette.accent)
    expect(appearance.querySelector('img').getAttribute('src')).toBe(logo)
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it.each(['invoice','quote'])('saves named palettes and reuses their colors in a %s without changing the logo',async kind=>{
    await render(kind);await click(button(kind==='quote'?'Nuevo presupuesto':'Nueva factura'))
    const appearance=container.querySelector('.document-appearance-details')
    await click(paletteButton(appearance,'Personalizada'))
    const name=appearance.querySelector('input[placeholder="Ej. Arena y mar"]')
    await input(name,' Arena y mar ')
    paletteMocks.save.mockRejectedValueOnce(new Error('offline'))
    await act(async()=>name.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})))
    expect(name.value).toBe(' Arena y mar ')
    expect(appearance.textContent).toContain(es.namedPalettes.saveError)
    const palette={...billingPalettes[0],id:'custom'}
    paletteMocks.save.mockResolvedValueOnce({id:'palette-1',company_id:'company-a',name:'Arena y mar',palette})
    await click(button(es.namedPalettes.save))
    expect(name.value).toBe('')
    expect(paletteMocks.save).toHaveBeenLastCalledWith('company-a',' Arena y mar ',expect.objectContaining({id:'custom'}))
    await click(paletteButton(appearance,'Oliva'))
    await chooseSavedPalette('palette-1')
    expect(paletteButton(appearance,'Personalizada').getAttribute('aria-pressed')).toBe('true')
    expect(appearance.querySelector('.color-selector input').value).toBe(palette.accent)
    expect(mocks.saveProfile).not.toHaveBeenCalled()
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })

  it('does not apply a palette response from the previous company to the current library',async()=>{
    let resolve
    paletteMocks.load.mockImplementationOnce(()=>new Promise(done=>{resolve=done}))
    await render();await click(button('Nueva factura'))
    mocks.company={id:'company-b',name:'Company B'}
    await render()
    await act(async()=>resolve([{id:'foreign',company_id:'company-a',name:'Only company A',palette:{...billingPalettes[0],id:'custom'}}]))
    expect(container.textContent).not.toContain('Only company A')
    expect(paletteMocks.load).toHaveBeenLastCalledWith('company-b')
  })

  it('keeps document editing available when the palette library fails and supports retry',async()=>{
    paletteMocks.load.mockRejectedValueOnce(new Error('unavailable'))
    await render();await click(button('Nueva factura'))
    expect(container.querySelector('#invoice-editor')).toBeTruthy()
    expect(container.textContent).toContain(es.namedPalettes.loadError)
    paletteMocks.load.mockResolvedValueOnce([{id:'a1',company_id:'company-a',name:'Recuperada',palette:{...billingPalettes[0],id:'custom'}}])
    await click(button(es.invoicing.retry))
    expect([...savedPaletteSelect().options].map(option=>option.textContent)).toContain('Recuperada')
    expect(container.textContent).not.toContain(es.namedPalettes.loadError)
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })

  it('discards a named palette saved after switching company',async()=>{
    let resolve
    paletteMocks.save.mockImplementation(()=>new Promise(done=>{resolve=done}))
    await render();await click(button('Nueva factura'))
    await click(paletteButton(container.querySelector('.document-appearance-details'),'Personalizada'))
    await input(container.querySelector('input[placeholder="Ej. Arena y mar"]'),'Private A')
    await click(button(es.namedPalettes.save))
    mocks.company={id:'company-b',name:'Company B'}
    await render()
    await act(async()=>resolve({id:'a1',company_id:'company-a',name:'Private A',palette:{...billingPalettes[0],id:'custom'}}))
    expect(container.textContent).not.toContain('Private A')
  })

  it('lets a reader see the library without a named palette save control',async()=>{
    mocks.canEdit=false
    mocks.load.mockResolvedValue({invoices:[record()],profile:savedProfile,profileVersion:3})
    paletteMocks.load.mockResolvedValue([{id:'a1',company_id:'company-a',name:'Arena',palette:{...billingPalettes[0],id:'custom'}}])
    await render('invoice','/invoicing/i1')
    expect(container.querySelector('.document-appearance-details')).toBeTruthy()
    expect([...savedPaletteSelect().options].map(option=>option.textContent)).toContain('Arena')
    expect(button(es.namedPalettes.save)).toBeUndefined()
  })

  it('guides each color role and updates blocked swatches as related HEX values change',async()=>{
    await render();await click(button('Nueva factura'))
    const appearance=container.querySelector('.document-appearance-details')
    await click(paletteButton(appearance,'Personalizada'))
    const blocks=appearance.querySelectorAll('.color-selector')
    const swatch=(index,color)=>[...blocks[index].querySelectorAll('button')].find(item=>item.style.getPropertyValue('--swatch')===color)
    const hex=index=>blocks[index].querySelector('input')
    expect(swatch(1,'#ffffff').disabled).toBe(true)
    expect(swatch(1,'#ffffff').title).toContain(es.billingAppearance.paper)
    expect(swatch(1,'#ffffff').title).toContain(es.billingAppearance.surface)
    const initialInk=hex(1).value
    await click(swatch(1,'#ffffff'))
    expect(hex(1).value).toBe(initialInk)
    await input(hex(0),'#767676')
    expect(swatch(3,'#f5f9ff').disabled).toBe(true)
    await input(hex(0),'#334155')
    expect(swatch(3,'#f5f9ff').disabled).toBe(false)
    await click(swatch(3,'#f5f9ff'))
    expect(hex(3).value).toBe('#f5f9ff')
    expect(appearance.querySelector('[role="alert"]')).toBeNull()
    await input(hex(1),'#ffffff')
    expect(hex(1).getAttribute('aria-invalid')).toBe('true')
    expect(hex(1).validity.customError).toBe(true)
    expect(hex(0).validity.customError).toBe(false)
    const errorId=hex(1).getAttribute('aria-describedby').split(' ').at(-1)
    expect(document.getElementById(errorId).textContent).toContain(es.billingAppearance.paper)
    await click(swatch(1,'#20252b'))
    expect(hex(1).hasAttribute('aria-invalid')).toBe(false)
    expect(hex(1).validity.customError).toBe(false)
    expect(appearance.querySelector('[role="alert"]')).toBeNull()
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it.each(['invoice','quote'])('retains a %s logo after a failed replacement and allows retry and removal',async kind=>{
    const original='data:image/png;base64,iVBORw0KGgo='
    mocks.load.mockResolvedValue({invoices:[],profile:{...savedProfile,logo:original},profileVersion:3})
    await render(kind);await click(button(kind==='quote'?'Nuevo presupuesto':'Nueva factura'))
    const appearance=container.querySelector('.document-appearance-details')
    const upload=appearance.querySelector('input[type="file"]')
    // A transparent dark logo needs the document's paper, including in a dark panel.
    expect(appearance.querySelector('img').parentElement.style.background).toMatch(/#ffffff|rgb\(255, 255, 255\)/)
    const selectLogo=async()=>{
      Object.defineProperty(upload,'files',{configurable:true,value:[new File(['data'],'logo.png',{type:'image/png'})]})
      await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})))
    }
    mocks.readLogo.mockRejectedValueOnce(new Error('decode failed'))
    await selectLogo()
    expect(appearance.querySelector('[role="alert"]').textContent).toBe(es.invoicing.logoError)
    expect(upload.getAttribute('aria-invalid')).toBe('true')
    expect(upload.getAttribute('aria-describedby').split(' ').map(id=>document.getElementById(id).textContent)).toEqual([es.invoicing.logoHelp,es.invoicing.logoError])
    expect(appearance.querySelector('img').getAttribute('src')).toBe(original)
    expect(upload.disabled).toBe(false)
    const replacement='data:image/jpeg;base64,/9j/AA=='
    mocks.readLogo.mockResolvedValueOnce(replacement)
    await selectLogo()
    expect(appearance.querySelector('[role="alert"]')).toBeNull()
    expect(upload.hasAttribute('aria-invalid')).toBe(false)
    expect(appearance.querySelector('img').getAttribute('src')).toBe(replacement)
    await click(button(es.invoicing.removeLogo))
    expect(appearance.querySelector('img')).toBeNull()
    expect(mocks.saveProfile).not.toHaveBeenCalled()
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
  })

  it('places the summary before the form, including new documents and preview mode',async()=>{
    await render();await click(button('Nueva factura'))
    const summary=container.querySelector('[aria-label="Resumen"]'),form=container.querySelector('#invoice-editor')
    expect(summary.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(form.querySelector('[aria-label="Resumen"]')).toBeNull()
    await click(button('Vista previa'))
    expect(container.querySelector('[aria-label="Resumen"]')).toBe(summary)
  })
  it.each(['invoice','quote'])('customizes a %s and saves company defaults only on explicit request',async kind=>{
    await render(kind);await click(button(kind==='quote'?'Nuevo presupuesto':'Nueva factura'))
    await click(paletteButton(container.querySelector('.document-appearance-details'),'Océano'))
    expect(mocks.saveProfile).not.toHaveBeenCalled()
    await click(button(es.billingAppearance.saveDefault))
    expect(mocks.saveProfile).toHaveBeenCalledWith('company-a',expect.objectContaining({name:'Company A',palette:billingPalettes[1]}),3)
    expect(mocks.saveInvoice).not.toHaveBeenCalled()
    await click(button(es.billingAppearance.reset))
    expect(paletteButton(container.querySelector('.document-appearance-details'),'Océano').getAttribute('aria-pressed')).toBe('true')
  })
  it('keeps historical document appearance when company defaults are edited',async()=>{
    const old=record();old.document.issuer={...savedProfile,palette:billingPalettes[1]}
    mocks.load.mockResolvedValue({invoices:[old],profile:savedProfile,profileVersion:3})
    await render('invoice','/invoicing/i1')
    await click(button(es.invoicing.settings))
    const dialog=container.querySelector('[role="dialog"]')
    await click(paletteButton(dialog,'Oliva'))
    await act(async()=>dialog.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
    await click(button('Descargar PDF'))
    expect(mocks.saveProfile).toHaveBeenCalledWith('company-a',expect.objectContaining({palette:billingPalettes[2]}),3)
    expect(mocks.download.mock.calls[0][0].document.issuer.palette).toEqual(billingPalettes[1])
  })
  it('shows custom HEX controls without a native color picker and rejects unreadable colors',async()=>{
    await render();await click(button('Nueva factura'))
    const appearance=container.querySelector('.document-appearance-details')
    await click(paletteButton(appearance,'Personalizada'))
    expect(appearance.querySelector('input[type="color"]')).toBeNull()
    const hex=appearance.querySelectorAll('.color-selector input')
    expect(hex).toHaveLength(5)
    await input(hex[1],'#ffffff')
    expect(appearance.textContent).toContain(es.billingColorPicker.invalid)
    expect(button(es.billingAppearance.saveDefault).disabled).toBe(true)
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })
  it('merges a decoded logo into the latest document without overwriting edits made while decoding',async()=>{
    let decoded
    mocks.readLogo.mockImplementation(()=>new Promise(resolve=>{decoded=resolve}))
    await render();await click(button('Nueva factura'))
    await click(issuerSection().querySelector('[role="switch"]'))
    const upload=container.querySelector('.document-appearance-details input[type="file"]')
    Object.defineProperty(upload,'files',{configurable:true,value:[new File(['data'],'logo.png',{type:'image/png'})]})
    await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})))
    await input(issuerSection().querySelector('[data-field="name"] input'),'Issuer edited during decoding')
    const logo='data:image/png;base64,iVBORw0KGgo='
    await act(async()=>decoded(logo))
    expect(issuerSection().querySelector('[data-field="name"] input').value).toBe('Issuer edited during decoding')
    expect(container.querySelector('.document-appearance-details img').getAttribute('src')).toBe(logo)
    expect(button(es.billingAppearance.saveDefault).disabled).toBe(false)
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })
})
