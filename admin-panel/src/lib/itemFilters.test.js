import { describe, expect, it } from 'vitest'
import {
  castFilterValue,
  distinctValues,
  hasActiveFilters,
  readFiltersFromParams,
  valueColumnFor,
  writeFiltersToParams,
} from './itemFilters'

describe('itemFilters — tipos de dato', () => {
  it('los atributos integer/decimal filtran por value_number (antes leían value_text y nunca coincidían)', () => {
    expect(valueColumnFor('integer')).toBe('value_number')
    expect(valueColumnFor('decimal')).toBe('value_number')
    expect(valueColumnFor('longtext')).toBe('value_text')
    expect(valueColumnFor('text_array')).toBe('value_text_array')
  })

  it('castea los valores que llegan como texto', () => {
    expect(castFilterValue('integer', '3')).toBe(3)
    expect(castFilterValue('decimal', '2.5')).toBe(2.5)
    expect(castFilterValue('integer', 'abc')).toBeNull()
    expect(castFilterValue('boolean', 'true')).toBe(true)
    expect(castFilterValue('boolean', 'false')).toBe(false)
    expect(castFilterValue('text', 'Piso')).toBe('Piso')
  })

  it('las opciones salen de todas las filas, sin duplicados y bien ordenadas', () => {
    const rows = [
      { value_number: 10 }, { value_number: 2 }, { value_number: 10 }, { value_number: null },
    ]
    expect(distinctValues(rows, 'integer')).toEqual(['2', '10'])
    expect(distinctValues([{ value_text_array: ['b', 'a'] }, { value_text_array: ['a'] }], 'text_array'))
      .toEqual(['a', 'b'])
  })
})

describe('itemFilters — estado en la URL', () => {
  it('ida y vuelta sin perder nada (volver desde un item conserva los filtros)', () => {
    const filters = {
      status: ['draft', 'published'],
      itemType: ['property'],
      sort: 'asc',
      q: 'ático',
      page: 3,
      attrs: { 'def-1': ['2', '3'] },
    }
    const roundTrip = readFiltersFromParams(new URLSearchParams(writeFiltersToParams(filters).toString()))
    expect(roundTrip).toEqual(filters)
  })

  it('omite los valores por defecto para que la URL quede limpia', () => {
    const params = writeFiltersToParams({ status: [], itemType: [], sort: null, q: '  ', page: 1, attrs: {} })
    expect(params.toString()).toBe('')
  })

  it('una página inválida en la URL vuelve a la 1', () => {
    expect(readFiltersFromParams(new URLSearchParams('page=-4')).page).toBe(1)
    expect(readFiltersFromParams(new URLSearchParams('page=xx')).page).toBe(1)
  })

  it('detecta si hay algún filtro activo', () => {
    expect(hasActiveFilters(readFiltersFromParams(new URLSearchParams('')))).toBe(false)
    expect(hasActiveFilters(readFiltersFromParams(new URLSearchParams('a.def-1=x')))).toBe(true)
  })
})
