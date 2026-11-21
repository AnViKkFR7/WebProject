// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SlidingIndicator from './SlidingIndicator'

const rect = (left, width) => ({ left, top: 0, width, height: 30, right: left + width, bottom: 30, x: left, y: 0 })

function Options({ value }) {
  return (
    <div data-testid="group">
      <SlidingIndicator activeSelector="[aria-pressed='true']" itemSelector="button" />
      <button type="button" data-left="10" aria-pressed={value === 'a'}>A</button>
      <button type="button" data-left="80" aria-pressed={value === 'b'}>B</button>
    </div>
  )
}

let host, root
const render = async value => act(async () => root.render(<Options value={value} />))
const group = () => host.querySelector('[data-testid="group"]')
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('without measurements it leaves the container unmarked so the active option keeps its own style', async () => {
  await render('a')
  expect(group().dataset.indicator).toBeUndefined()
  expect(group().querySelector('.slide-indicator').getAttribute('aria-hidden')).toBe('true')
})

it('sits under the active option, follows changes and moves on the click itself', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.dataset.left ? rect(Number(this.dataset.left), 60) : rect(0, 200)
  })
  await render('a')
  const indicator = group().querySelector('.slide-indicator')
  expect(group().dataset.indicator).toBe('ready')
  expect(indicator.style.transform).toContain('translate3d(10px')
  expect(indicator.style.width).toBe('60px')

  await act(async () => group().querySelectorAll('button')[1].dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 })))
  expect(indicator.style.transform).toContain('translate3d(80px')

  await render('a')
  expect(indicator.style.transform).toContain('translate3d(10px')
})
