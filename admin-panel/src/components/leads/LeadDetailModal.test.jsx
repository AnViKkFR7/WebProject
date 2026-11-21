// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LeadDetailModal from './LeadDetailModal'

vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => ({ t: key => key }) }))
vi.mock('../ui/Modal', () => ({ default: ({ children, footer }) => <div role="dialog">{children}{footer}</div> }))

let host, root
const render = async lead => act(async () => root.render(
  <MemoryRouter><LeadDetailModal lead={{ id: 'l1', name: 'Ana', status: 'new', created_at: '2026-11-20T10:00:00Z', ...lead }} canEdit saving={false} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} /></MemoryRouter>,
))
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('opens the linked contact directly from the request', async () => {
  await render({ crm_contact_id: 'c 1', crm_match_state: 'linked' })
  const link = host.querySelector('a[href="/contacts?contact=c%201"]')
  expect(link.textContent).toContain('leads.openContact')
})

it('sends ambiguous requests to the Contacts review', async () => {
  await render({ crm_contact_id: null, crm_match_state: 'review_required' })
  expect(host.querySelector('a[href="/contacts"]').textContent).toContain('leads.reviewContact')
})

it('offers no contact action while the request is not processed yet', async () => {
  await render({ crm_contact_id: null, crm_match_state: 'unprocessed' })
  expect(host.querySelector('a[href^="/contacts"]')).toBeNull()
})
