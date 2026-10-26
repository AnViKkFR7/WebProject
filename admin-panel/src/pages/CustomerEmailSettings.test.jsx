// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {defaultCustomerEmailSettings} from '../lib/customerEmailTemplate'

const mocks=vi.hoisted(()=>({company:{id:'company-1',name:'Taller Norte',userRole:'admin'},platformAdmin:false,load:vi.fn(),loadHistory:vi.fn(),loadPalettes:vi.fn(),save:vi.fn(),restore:vi.fn(),toast:{success:vi.fn()},translate:key=>key}))
vi.mock('../contexts/CompanyContext',()=>({useCompany:()=>({selectedCompany:mocks.company,isPlatformAdmin:mocks.platformAdmin})}))
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({language:'es',t:mocks.translate})}))
vi.mock('../contexts/FeedbackContext',()=>({useFeedback:()=>({toast:mocks.toast})}))
vi.mock('../services/customerEmailSettingsService',()=>({loadCustomerEmailSettings:(...args)=>mocks.load(...args),loadCustomerEmailRevisions:(...args)=>mocks.loadHistory(...args),saveCustomerEmailSettings:(...args)=>mocks.save(...args),restoreCustomerEmailRevision:(...args)=>mocks.restore(...args)}))
vi.mock('../services/billingPaletteService',()=>({loadBillingPalettes:(...args)=>mocks.loadPalettes(...args),saveBillingPalette:vi.fn()}))
import CustomerEmailSettings from './CustomerEmailSettings'

let root,container
const render=async()=>act(async()=>root.render(<CustomerEmailSettings/>))
const click=async element=>act(async()=>element.click())
beforeEach(()=>{
  mocks.company={id:'company-1',name:'Taller Norte',userRole:'admin'};mocks.platformAdmin=false
  mocks.load.mockReset().mockResolvedValue(defaultCustomerEmailSettings());mocks.loadHistory.mockReset().mockResolvedValue([]);mocks.save.mockReset().mockResolvedValue('2026-10-26T12:00:00Z');mocks.restore.mockReset().mockResolvedValue('2026-10-26T12:00:00Z');mocks.toast.success.mockReset()
  mocks.loadPalettes.mockReset().mockResolvedValue([{id:'palette-1',company_id:'company-1',name:'Azul marino',palette:{id:'custom',accent:'#123456',ink:'#102030',muted:'#304050',paper:'#ffffff',surface:'#f3f4f6'}}])
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})

describe('customer email settings',()=>{
  it('limits editing to a company administrator',async()=>{
    mocks.company={id:'company-1',name:'Taller Norte',userRole:'editor'}
    await render()
    expect(container.textContent).toContain('customerEmails.forbidden')
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('shows the shared brand, localized template editor and a no-send preview',async()=>{
    await render()
    expect(mocks.load).toHaveBeenCalledWith('company-1')
    expect(mocks.loadPalettes).toHaveBeenCalledWith('company-1')
    expect(container.textContent).toContain('customerEmails.sharedBadge')
    expect(container.querySelector('iframe').getAttribute('sandbox')).toBe('')
    const preview=container.querySelector('iframe').getAttribute('srcdoc')
    expect(preview).toContain('Este mensaje te lo envía')
    expect(preview).toContain('>Taller Norte</div>')
    expect(preview).toContain('href="https://www.moiraordo.es"')
    expect(preview.match(/Este mensaje te lo envía/g)).toHaveLength(1)
    expect(container.querySelector('select[aria-label="namedPalettes.select"]')).not.toBeNull()
  })

  it('applies a saved company palette to the shared email preview',async()=>{
    await render()
    const selector=container.querySelector('select[aria-label="namedPalettes.select"]')
    await act(async()=>{selector.value='palette-1';selector.dispatchEvent(new Event('change',{bubbles:true}))})
    expect(container.querySelector('iframe').getAttribute('srcdoc')).toContain('background:#123456')
  })

  it('saves the shared configuration and retains the editor page',async()=>{
    await render()
    await click(container.querySelector('button[type="submit"]'))
    expect(mocks.save).toHaveBeenCalledWith('company-1',expect.objectContaining({brand:expect.any(Object),templates:expect.any(Object)}))
    expect(container.querySelector('h1').textContent).toBe('customerEmails.title')
    expect(container.textContent).toContain('customerEmails.saved')
  })

  it('lets the company choose the language actually used by customer emails',async()=>{
    await render()
    const sendLanguageLabel=[...container.querySelectorAll('label')].find(label=>label.textContent.includes('customerEmails.sendLanguage'))
    const sendLanguage=sendLanguageLabel.querySelector('select')
    expect(sendLanguage.value).toBe('es')
    await act(async()=>{sendLanguage.value='en';sendLanguage.dispatchEvent(new Event('change',{bubbles:true}))})
    await click(container.querySelector('button[type="submit"]'))
    expect(mocks.save).toHaveBeenCalledWith('company-1',expect.objectContaining({brand:expect.objectContaining({emailLanguage:'en'})}))
  })

  it('does not offer saving when a template contains unsafe HTML',async()=>{
    const settings=defaultCustomerEmailSettings();settings.templates.quote_approval.es.html='<script>steal()</script>'
    mocks.load.mockResolvedValue(settings)
    await render()
    expect(container.textContent).toContain('customerEmails.invalidTemplate')
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('shows prior versions and confirms restoration without leaving the settings page',async()=>{
    mocks.loadHistory.mockResolvedValue([{revision_id:'revision-12345678',created_at:'2026-10-25T10:00:00.000Z',created_by:'user-12345678-abc',settings:defaultCustomerEmailSettings()}])
    vi.stubGlobal('confirm',vi.fn(()=>true))
    await render()
    expect(container.textContent).toContain('customerEmails.historyTitle')
    expect(container.textContent).toContain('user-123')
    await click([...container.querySelectorAll('button')].find(button=>button.textContent==='customerEmails.restore'))
    expect(mocks.restore).toHaveBeenCalledWith('company-1','revision-12345678')
    expect(container.querySelector('h1').textContent).toBe('customerEmails.title')
  })
})
