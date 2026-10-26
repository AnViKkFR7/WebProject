// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import QuoteApproval from './QuoteApproval'

const mocks = vi.hoisted(() => ({
  service: { details: vi.fn(), respond: vi.fn() },
}))

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: key => key, language: 'es' }),
}))
vi.mock('../services/quoteApprovalService', () => ({ quoteApprovalService: mocks.service }))
vi.mock('../components/DocumentPreview', () => ({ default: () => null }))

let root
let host
const token = 'a'.repeat(64)

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  window.history.replaceState(null, '', `/quotes/respond#${token}`)
  mocks.service.details.mockResolvedValue({
    number: 'Q-001',
    status: 'sent',
    document: {},
    decision: null,
    expires_at: '2026-11-30T12:00:00Z',
  })
  mocks.service.respond.mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

const renderPage = async () => act(async () => {
  root.render(<QuoteApproval />)
  await Promise.resolve()
  await Promise.resolve()
})

const enter = (element, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set
  act(() => {
    setter.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

it('preserves declared identity after a failed response and shows the final decision after retry', async () => {
  mocks.service.respond
    .mockRejectedValueOnce(new Error('network unavailable'))
    .mockResolvedValueOnce({ decision: 'accepted', responded_at: '2026-10-26T10:00:00Z' })
  await renderPage()

  const form = host.querySelector('form')
  const [name, email] = form.querySelectorAll('input:not([type="radio"]):not([type="checkbox"])')
  enter(name, 'Ana Pérez')
  enter(email, 'ana@example.test')
  const confirm = form.querySelector('input[type="checkbox"]')
  act(() => confirm.click())

  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('quoteApproval.submitError')
  expect(name.value).toBe('Ana Pérez')
  expect(email.value).toBe('ana@example.test')

  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(mocks.service.respond).toHaveBeenCalledTimes(2)
  expect(mocks.service.respond).toHaveBeenLastCalledWith(token, 'accepted', 'Ana Pérez', 'ana@example.test', '')
  expect(host.querySelector('[role="status"] h2')?.textContent).toBe('quoteApproval.accepted')
  expect(window.location.hash).toBe('')
})

it('rejects an invalid public link without requesting quote details', async () => {
  window.history.replaceState(null, '', '/quotes/respond#invalid')
  await renderPage()
  expect(host.querySelector('[role="alert"] h2')?.textContent).toBe('quoteApproval.unavailableTitle')
  expect(mocks.service.details).not.toHaveBeenCalled()
})
