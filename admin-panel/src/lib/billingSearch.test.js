import { expect, it } from 'vitest'
import { matchesBillingSearch } from './billingSearch'

const invoice = (taxId, name = 'Lucía Ribas', number = 'F-2026-0007') => ({
  number,
  document: { customer: { name, taxId }, lines: [{ description: 'Reforma de baño' }] },
})

it('encuentra el NIF aunque esté escrito con guiones, espacios o puntos', () => {
  for (const stored of ['47680312P', '47680312-P', '47.680.312 P', '47680312p']) {
    expect(matchesBillingSearch(invoice(stored), '47680312P')).toBe(true)
  }
  expect(matchesBillingSearch(invoice('B12345678'), 'B-12.345.678')).toBe(true)
})

it('no confunde NIF distintos', () => {
  expect(matchesBillingSearch(invoice('47680312-P'), '47680313P')).toBe(false)
})

it('busca por nombre, número y concepto sin tildes ni mayúsculas', () => {
  expect(matchesBillingSearch(invoice(''), 'lucia ribas')).toBe(true)
  expect(matchesBillingSearch(invoice(''), 'f-2026-0007')).toBe(true)
  expect(matchesBillingSearch(invoice(''), 'BANO')).toBe(true)
  expect(matchesBillingSearch(invoice(''), 'Marta')).toBe(false)
})

it('la búsqueda vacía muestra todo y la de signos sueltos no lo cuela todo', () => {
  expect(matchesBillingSearch(invoice('47680312P'), '   ')).toBe(true)
  expect(matchesBillingSearch(invoice('47680312P'), '--')).toBe(false)
})

it('tolera documentos incompletos', () => {
  expect(matchesBillingSearch({ number: 'P-1', document: {} }, 'p-1')).toBe(true)
  expect(matchesBillingSearch({}, 'algo')).toBe(false)
})
