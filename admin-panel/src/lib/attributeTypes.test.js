import { describe, expect, it } from 'vitest'
import {
  displayItemType,
  keyFromLabel,
  moveDefinition,
  parseLabel,
  serializeLabel,
  sortDefinitions,
  storageFieldsFor,
  uiTypeOf,
  uniqueKey,
} from './attributeTypes'

describe('attributeTypes — lista de opciones', () => {
  it('una lista de opciones se guarda como text + validation_rules.options', () => {
    expect(storageFieldsFor('options', [' Sur ', 'Norte', '', 'Sur'])).toEqual({
      data_type: 'text',
      validation_rules: { options: ['Sur', 'Norte'] },
    })
  })

  it('y se reconoce al leerla (antes no había pantalla para definirlas)', () => {
    expect(uiTypeOf({ data_type: 'text', validation_rules: { options: ['a'] } })).toBe('options')
    expect(uiTypeOf({ data_type: 'text', validation_rules: null })).toBe('text')
  })

  it('cambiar a otro tipo limpia las opciones', () => {
    expect(storageFieldsFor('integer')).toEqual({ data_type: 'integer', validation_rules: null })
  })

  it('tipos antiguos o desconocidos no rompen', () => {
    expect(uiTypeOf({ data_type: 'number' })).toBe('decimal')
    expect(uiTypeOf({ data_type: 'json' })).toBe('text')
  })
})

describe('attributeTypes — etiquetas ES / EN sin JSON a la vista', () => {
  it('lee JSON bilingüe y texto plano', () => {
    expect(parseLabel('{"es":"Año","en":"Year"}')).toEqual({ es: 'Año', en: 'Year' })
    expect(parseLabel('Habitaciones')).toEqual({ es: 'Habitaciones', en: '' })
    expect(parseLabel('{roto')).toEqual({ es: '{roto', en: '' })
  })

  it('sin inglés guarda texto plano; con inglés, JSON', () => {
    expect(serializeLabel({ es: ' Año ', en: '' })).toBe('Año')
    expect(JSON.parse(serializeLabel({ es: 'Año', en: 'Year' }))).toEqual({ es: 'Año', en: 'Year' })
  })
})

describe('attributeTypes — clave técnica', () => {
  it('se genera sin acentos ni símbolos', () => {
    expect(keyFromLabel('Nº de baños')).toBe('n_de_banos')
  })

  it('no choca con otra del mismo tipo de item', () => {
    expect(uniqueKey('Precio', ['precio', 'precio_2'])).toBe('precio_3')
    expect(uniqueKey('!!!', [])).toBe('atributo')
  })
})

describe('attributeTypes — orden', () => {
  const defs = [
    { id: 'b', sort_order: 1, created_at: '2026-01-02' },
    { id: 'a', sort_order: 0, created_at: '2026-01-03' },
    { id: 'c', created_at: '2026-01-01' },
  ]

  it('ordena por sort_order y, si falta, por fecha de creación', () => {
    expect(sortDefinitions(defs).map((d) => d.id)).toEqual(['c', 'a', 'b'])
  })

  it('mover renumera de forma consecutiva', () => {
    const moved = moveDefinition(sortDefinitions(defs), 2, 0)
    expect(moved.map((d) => [d.id, d.sort_order])).toEqual([['b', 0], ['c', 1], ['a', 2]])
  })

  it('mover fuera de rango no cambia nada', () => {
    expect(moveDefinition(defs, 0, -1)).toBe(defs)
  })
})

describe('attributeTypes — nombre del tipo de item', () => {
  it('quita el sufijo de empresa que se añade al guardar', () => {
    expect(displayItemType('Piso_Regiamare', 'Regiamare ')).toBe('Piso')
    expect(displayItemType('Piso', 'Regiamare')).toBe('Piso')
  })
})
