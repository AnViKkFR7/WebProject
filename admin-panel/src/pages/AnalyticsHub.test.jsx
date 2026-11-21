// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AnalyticsHub from './AnalyticsHub'
import AnalyticsIntegrations from './AnalyticsIntegrations'

const mocks = vi.hoisted(() => ({ company: { id: 'tenant-a', name: 'Empresa A' } }))
vi.mock('../contexts/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: mocks.company }) }))
vi.mock('../contexts/LanguageContext', () => ({ useLanguage: () => ({ t: key => key }) }))

let host, root
const Where = () => <output data-testid="where">{useLocation().pathname}</output>
const render = async path => act(async () => root.render(
  <MemoryRouter initialEntries={[path]}>
    <Where />
    <Routes>
      <Route path="/analytics" element={<AnalyticsHub />}>
        <Route path="web" element={<p>web-content</p>} />
        <Route path="integrations" element={<AnalyticsIntegrations />} />
      </Route>
    </Routes>
  </MemoryRouter>,
))
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  mocks.company = { id: 'tenant-a', name: 'Empresa A' }
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('opens the websites tab by default and keeps the existing analytics inside it', async () => {
  await render('/analytics')
  expect(host.querySelector('[data-testid="where"]').textContent).toBe('/analytics/web')
  expect(host.textContent).toContain('web-content')
  const tabs = [...host.querySelectorAll('nav a')].map(a => a.getAttribute('href'))
  expect(tabs).toEqual(['/analytics/web', '/analytics/integrations'])
})

it('lists the four platforms as pending, without a connect action', async () => {
  await render('/analytics/integrations')
  expect(host.querySelectorAll('li')).toHaveLength(4)
  for (const key of ['googleAnalytics', 'meta', 'googleBusiness', 'appleBusiness']) expect(host.textContent).toContain(`analyticsHub.integrations.${key}.name`)
  expect(host.querySelectorAll('li button')).toHaveLength(0)
})

it('asks to pick a company when none is selected', async () => {
  mocks.company = null
  await render('/analytics/web')
  expect(host.textContent).toContain('dashboard.selectCompanyDescription')
  expect(host.querySelector('nav')).toBeNull()
})
