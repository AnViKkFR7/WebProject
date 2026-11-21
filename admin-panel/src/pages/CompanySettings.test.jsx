// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { permissionsFor } from '../lib/permissions'
import CompanySettings from './CompanySettings'

const state = vi.hoisted(() => ({ role: 'admin', platform: false, modules: { billing: true } }))
vi.mock('../contexts/LanguageContext', () => ({ useLanguage: () => ({ t: key => key }) }))
vi.mock('../contexts/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: { id: 'company-a', name: 'Arquelia', userRole: state.role } }) }))
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => permissionsFor(state.role, state.platform) }))
vi.mock('../hooks/useCompanyModules', () => ({ useCompanyModules: () => ({ modules: state.modules, loading: false }) }))

let host, root, router
const render = async path => {
  router = createMemoryRouter([{ path: '/settings', element: <CompanySettings />, children: [
    { path: 'general', element: <p>general-page</p> },
    { path: 'modules', element: <p>modules-page</p> },
    { path: 'emails', element: <p>emails-page</p> },
    { path: 'privacy', element: <p>privacy-page</p> },
  ] }], { initialEntries: [path] })
  await act(async () => root.render(<RouterProvider router={router} />))
}
const tabs = () => [...host.querySelectorAll('nav a')].map(link => link.getAttribute('href'))

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.assign(state, { role: 'admin', platform: false, modules: { billing: true } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('opens the first allowed tab and lists only what a company admin can manage', async () => {
  await render('/settings')
  expect(router.state.location.pathname).toBe('/settings/general')
  expect(tabs()).toEqual(['/settings/general', '/settings/emails', '/settings/privacy'])
  expect(host.textContent).toContain('general-page')
})

it('shows Modules only to the platform admin and hides Emails without billing', async () => {
  Object.assign(state, { role: null, platform: true, modules: { billing: false } })
  await render('/settings/modules')
  expect(tabs()).toEqual(['/settings/general', '/settings/modules', '/settings/privacy'])
  expect(host.textContent).toContain('modules-page')
})

it('denies editors, even when they open a tab URL directly', async () => {
  state.role = 'editor'
  await render('/settings/privacy')
  expect(host.querySelector('[role=alert]').textContent).toBe('companySettings.forbidden')
  expect(host.textContent).not.toContain('privacy-page')
})
