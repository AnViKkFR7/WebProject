// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { es } from '../locales/es'
import { LanguageProvider } from '../contexts/LanguageContext'
import { ContactModal } from './Contacts'
import { crmService } from '../services/crmService'

vi.mock('../services/crmService', () => ({
  crmService: {
    getContactTimeline: vi.fn(),
    getContactBilling: vi.fn(),
    updateContact: vi.fn(),
    addActivity: vi.fn(),
    linkBillingDocument: vi.fn(),
    unlinkBillingDocument: vi.fn(),
  },
}))

let root
let host
const t = key => key.split('.').reduce((value, part) => value?.[part], es) || key

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  crmService.getContactTimeline.mockResolvedValue([
    { id: 'activity-1', kind: 'form', title: 'Solicitud recibida', details: 'Necesita una reforma', occurred_at: '2026-10-25T10:00:00.000Z' },
  ])
  crmService.getContactBilling.mockResolvedValue({
    linked: [{ id: 'link-1', document_kind: 'invoice', number: 'F-2026-001', status: 'issued', linked_at: '2026-10-26T10:00:00.000Z', document: { date: '2026-10-24', presentation: { title: 'Reforma integral' } } }],
    available: [],
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  document.querySelector('.modal-overlay')?.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('shows form requests and linked invoices together in one chronological timeline', async () => {
  await act(async () => root.render(
    <LanguageProvider>
      <ContactModal
        contact={{ id: 'contact-1', name: 'Ada', email: 'ada@example.com', source_path:'/items/casa-del-mar', source_item:'Casa del Mar · casa-del-mar', source_referrer:'https://search.example/', source_utm_campaign:'verano', source_utm_source:'google', source_utm_medium:'cpc', source_utm_term:'casa venta', source_utm_content:'anuncio-a' }}
        stages={[]}
        members={[]}
        canEdit={false}
        companyId="company-1"
        t={t}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        toast={{ success: vi.fn(), error: vi.fn() }}
      />
    </LanguageProvider>,
  ))

  const lists = document.querySelectorAll('.modal ol')
  expect(lists).toHaveLength(1)
  const entries = [...lists[0].querySelectorAll('li')]
  expect(entries).toHaveLength(2)
  expect(entries[0].textContent).toContain('Solicitud recibida')
  expect(entries[1].textContent).toContain('F-2026-001')
  expect(entries[1].textContent).toContain('24/10/2026')
  const attribution=document.querySelector('[aria-label="Origen y atribución"]')
  expect(attribution.textContent).toContain('/items/casa-del-mar')
  expect(attribution.textContent).toContain('Casa del Mar · casa-del-mar')
  expect(attribution.textContent).toContain('https://search.example/')
  expect(attribution.textContent).toContain('verano')
  expect(attribution.textContent).toContain('google')
  expect(attribution.textContent).toContain('cpc')
  expect(attribution.textContent).toContain('casa venta')
  expect(attribution.textContent).toContain('anuncio-a')
})
