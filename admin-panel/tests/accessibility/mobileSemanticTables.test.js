import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const root = new URL('../../', import.meta.url)
const css = readFileSync(new URL('src/App.css', root), 'utf8')
const invoicing = readFileSync(new URL('src/pages/Invoicing.jsx', root), 'utf8')
const scrollDepth = readFileSync(new URL('src/components/analytics/ScrollDepthCard.jsx', root), 'utf8')
const bulkAttributes = readFileSync(new URL('src/components/myData/AttributeDefinitionsForm.jsx', root), 'utf8')
const contacts = readFileSync(new URL('src/pages/Contacts.jsx', root), 'utf8')

it('limits mobile card conversion to the div-based Items table', () => {
  const mobileRules = css.match(/\/\* CARD VIEW for Tables \(Mobile Transformation\) \*\/(.*?)\/\* Header Actions Responsive \*\//s)?.[1]

  expect(mobileRules).toBeTruthy()
  expect(mobileRules).toContain('.table-row')
  expect(mobileRules).not.toMatch(/(?:^|[\s,])(?:thead|tbody|tr|td|th)(?:$|[\s,{])/m)
  expect(mobileRules).not.toContain('.table-container')
})

it('keeps horizontally scrollable semantic tables keyboard accessible and named', () => {
  expect(invoicing).toMatch(/className="invoice-table-scroll"[^>]*role="region"[^>]*aria-label=\{label\('title'\)\}[^>]*tabIndex=\{0\}/)
  expect(scrollDepth).toMatch(/className="depth-table-wrap"[^>]*role="region"[^>]*aria-label=\{t\('analytics\.scrollTitle'\)\}[^>]*tabIndex=\{0\}/)
  expect(bulkAttributes).toMatch(/className="bulk-table-wrap"[^>]*role="region"[^>]*aria-label=\{t\('attributes\.bulkTableLabel'\)\}[^>]*tabIndex=\{0\}/)
})

it('makes the horizontally scrolling CRM kanban a named keyboard region', () => {
  expect(contacts).toMatch(/className=\{styles\.board\} role="region" aria-label=\{t\('crm\.pipeline'\)\} tabIndex=\{0\}/)
})
