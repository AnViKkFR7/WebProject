// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNewLeadsCount } from './useNewLeadsCount'

const countNew = vi.hoisted(() => vi.fn())
vi.mock('../services/leadService', () => ({ leadService: { countNew } }))

let host, root
function Probe({ companyId, enabled }) { return <output>{useNewLeadsCount(companyId, enabled, 'k')}</output> }
const render = async props => act(async () => root.render(<Probe {...props} />))
const value = () => host.querySelector('output').textContent
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); countNew.mockReset() })

it('counts the new requests of the selected company only', async () => {
  countNew.mockImplementation(async id => (id === 'a' ? 3 : 0))
  await render({ companyId: 'a', enabled: true })
  expect(countNew).toHaveBeenCalledWith('a')
  expect(value()).toBe('3')
  let resolveB
  countNew.mockImplementation(() => new Promise(done => { resolveB = done }))
  await render({ companyId: 'b', enabled: true })
  expect(value()).toBe('0') // no arrastra el número de la empresa anterior
  await act(async () => resolveB(1))
  expect(value()).toBe('1')
})

it('does not query when the CRM module is off and hides errors', async () => {
  await render({ companyId: 'a', enabled: false })
  expect(countNew).not.toHaveBeenCalled()
  countNew.mockRejectedValue(new Error('rls'))
  await render({ companyId: 'a', enabled: true })
  expect(value()).toBe('0')
})
