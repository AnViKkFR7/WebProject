// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DirectoryParty from './DirectoryParty'

const mocks = vi.hoisted(() => ({ party: vi.fn(), summary: vi.fn(), update: vi.fn(), company: { id: 'tenant-a' }, modules: { planning: true, billing: true } }))
vi.mock('../services/clientCompanyService', () => ({ getDirectoryParty: mocks.party, getDirectoryPartySummary: mocks.summary, updateClientCompany: mocks.update }))
vi.mock('../contexts/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: mocks.company }) }))
vi.mock('../contexts/LanguageContext', () => ({ useLanguage: () => ({ t: key => key, language: 'es' }) }))
vi.mock('../contexts/FeedbackContext', () => ({ useFeedback: () => ({ toast: { success: vi.fn() } }) }))
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ canEdit: true }) }))
vi.mock('../hooks/useCompanyModules', () => ({ useCompanyModules: () => ({ modules: mocks.modules }) }))
vi.mock('../components/planning/ClientCompanyModal', () => ({ default: () => null }))

const collaborator = { id: 'p1', company_id: 'tenant-a', name: 'Lucía Pérez', legal_form: 'individual', is_client: false, is_collaborator: true, collaborator_role: 'Fotografía', responsible: 'No', tax_id: '123Z' }
const fullSummary = {
  party_id: 'p1', matched_by: 'tax_id',
  invoices: { count: 2, total: 242, paid: 121, outstanding: 121, overdue_count: 1, last_issued_on: '2026-11-02', monthly: [{ month: '2026-11', total: 242 }] },
  quotes: { count: 3, open: 1, accepted: 2, rejected: 0, accepted_total: 500 },
  planning: { count: 4, upcoming: 1, next: { id: 't', title: 'Sesión de fotos', start: '2026-12-01T10:00:00Z' } },
  movements: { count: 2, to_collect: 0, to_pay: 300 },
}

let host, root
const render = async () => act(async () => root.render(
  <MemoryRouter initialEntries={['/companies/p1']}><Routes><Route path="/companies/:partyId" element={<DirectoryParty />} /></Routes></MemoryRouter>,
))
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  mocks.company = { id: 'tenant-a' }; mocks.modules = { planning: true, billing: true }
  mocks.party.mockResolvedValue(collaborator); mocks.summary.mockResolvedValue(fullSummary)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals() })

it('loads the record of the selected company and shows its activity', async () => {
  await render()
  expect(mocks.party).toHaveBeenCalledWith('tenant-a', 'p1')
  expect(mocks.summary).toHaveBeenCalledWith('tenant-a', 'p1')
  const text = host.textContent
  expect(text).toContain('Lucía Pérez')
  expect(text).toContain('directory.collaborator')
  expect(text).toContain('directory.individual')
  expect(text).toContain('Fotografía')
  // Persona física: sin persona de contacto
  expect(text).not.toContain('directory.responsible')
  expect(text).toContain('directory.invoiced')
  expect(text).toContain('directory.toPay')
  expect(host.querySelectorAll('ol li')).toHaveLength(12)
  expect(text).toContain('directory.matchedByTax')
  // Singular con 1 (próxima tarea, vencida), plural con más
  expect(text).toContain('directory.tasksHintOne')
  expect(text).toContain('directory.overdueOne')
  expect(text).toContain('directory.invoicedHint')
  expect(text).not.toContain('directory.invoicedHintOne')
})

it('hides billing blocks when the server returns none (module off)', async () => {
  mocks.summary.mockResolvedValue({ ...fullSummary, invoices: null, quotes: null })
  await render()
  expect(host.textContent).not.toContain('directory.invoiced')
  expect(host.textContent).not.toContain('directory.monthlyTitle')
  expect(host.textContent).toContain('directory.tasks')
})

it('keeps the record visible when only the summary fails', async () => {
  mocks.summary.mockRejectedValue(new Error('boom'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await render()
  expect(host.textContent).toContain('Lucía Pérez')
  expect(host.querySelector('[role="alert"]').textContent).toContain('directory.summaryError')
})

it('shows not found for records of other companies (RLS returns nothing)', async () => {
  mocks.party.mockResolvedValue(null)
  await render()
  expect(host.textContent).toContain('directory.notFound')
  expect(mocks.summary).not.toHaveBeenCalled()
})

it('reloads with the new company when the selector changes', async () => {
  await render()
  mocks.company = { id: 'tenant-b' }
  mocks.party.mockResolvedValue(null)
  await render()
  expect(mocks.party).toHaveBeenLastCalledWith('tenant-b', 'p1')
  expect(host.textContent).not.toContain('Lucía Pérez')
})
