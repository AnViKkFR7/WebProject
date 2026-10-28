import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const root = new URL('../../', import.meta.url)
const appStyles = readFileSync(new URL('src/App.css', root), 'utf8')
const contactStyles = readFileSync(new URL('src/pages/Contacts.module.css', root), 'utf8')
const billingStyles = readFileSync(new URL('src/styles/invoicing.css', root), 'utf8')

it('adapts the shell to available content width on tablet and narrow desktop', () => {
  expect(appStyles).toContain('container: app-main / inline-size')
  expect(appStyles).toContain('@container app-main (max-width: 820px)')
  expect(appStyles).toContain('@container app-main (max-width: 620px)')
  expect(appStyles).toContain('min-width: 0;')
})

it('keeps CRM follow-up labels inside their metric cards at narrow widths', () => {
  expect(contactStyles).toContain('overflow-wrap: anywhere')
  expect(contactStyles).toContain('@container app-main (max-width: 700px)')
  expect(contactStyles).toContain('@container app-main (max-width: 420px)')
  expect(contactStyles).toContain('.overview > :last-child { grid-column: 1 / -1; }')
})

it('allows billing totals to wrap and reduces card columns before values overflow', () => {
  expect(billingStyles).toContain('overflow-wrap: anywhere')
  expect(billingStyles).toContain('@container app-main (max-width: 700px)')
  expect(billingStyles).toContain('@container app-main (max-width: 420px)')
})
