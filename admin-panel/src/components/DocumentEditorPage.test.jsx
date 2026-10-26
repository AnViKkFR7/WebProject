// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { es } from '../locales/es'
import DocumentEditorPage from './DocumentEditorPage'

vi.mock('./DocumentPreview', () => ({ default: () => null }))

let root
let host
const t = key => key.split('.').reduce((value, part) => value?.[part], es) || key

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

it('exposes the edit and preview mode buttons as a named group', async () => {
  await act(async () => root.render(
    <DocumentEditorPage
      title="Factura"
      company="Empresa"
      status="Borrador"
      dirty={false}
      saving={false}
      locked={false}
      onBack={vi.fn()}
      actions={null}
      summary={null}
      invoice={{}}
      t={t}
      language="es"
      kind="invoice"
    >
      <p>Campos del documento</p>
    </DocumentEditorPage>
  ))

  const group = host.querySelector('[role="group"]')
  expect(group).not.toBeNull()
  expect(group.getAttribute('aria-label')).toBe(es.documentWorkspace.view)
  expect(group.querySelectorAll('button')).toHaveLength(2)
  expect(document.activeElement).toBe(host.querySelector('h1'))
})
