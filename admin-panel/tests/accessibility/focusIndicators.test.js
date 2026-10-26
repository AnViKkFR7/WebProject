import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const css=readFileSync(new URL('../../src/App.css',import.meta.url),'utf8')
const itemMediaCss=readFileSync(new URL('../../src/styles/ItemMedia.css',import.meta.url),'utf8')

it('keeps a visible keyboard focus ring around the multi-select search after resetting the input outline',()=>{
  expect(css).toMatch(/\.multi-select-search input:focus-visible\s*\{\s*outline:\s*none;/)
  expect(css).toMatch(/\.multi-select-search:has\(input:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--primary-color\)/s)
})

it('keeps the keyboard focus for stretched links visible on their card',()=>{
  expect(css).toMatch(/\.stretched-link:focus-visible\s*\{\s*outline:\s*none;/)
  expect(css).toMatch(/\.is-linked:has\(\.stretched-link:focus-visible\)[\s\S]*?outline:\s*2px solid var\(--primary-color\)/)
  expect(css).toMatch(/\.item-card:has\(\.stretched-link:focus-visible\)[\s\S]*?outline:\s*2px solid var\(--primary-color\)/)
})

it('restores a visible keyboard outline on fields whose base focus styles removed it',()=>{
  expect(css).toMatch(/\.input:focus-visible[\s\S]*?\.select:focus-visible[\s\S]*?outline:\s*2px solid var\(--primary-color\)/)
  expect(css).toMatch(/\.form-group input:focus-visible/)
  expect(css).toMatch(/\.search-input:focus-visible/)
  expect(css).toMatch(/\.attribute-field input:focus-visible/)
  expect(css).toMatch(/\.attribute-field textarea:focus-visible/)
  expect(css).toMatch(/\.attribute-field select:focus-visible/)
  expect(itemMediaCss).toMatch(/\.description-edit \.input:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--primary-color\)/s)
})
