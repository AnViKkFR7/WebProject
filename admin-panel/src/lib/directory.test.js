import { describe, expect, it } from 'vitest'
import { filterDirectory, lastTwelveMonths, partyToForm } from './directory'

const parties = [
  { id: 'legacy', name: 'Antigua SL', tax_id: 'B-12345678' },
  { id: 'photo', name: 'Lucía Pérez', legal_form: 'individual', is_client: false, is_collaborator: true, collaborator_role: 'Fotografía' },
  { id: 'both', name: 'Correas Norte SA', legal_form: 'company', is_client: true, is_collaborator: true, collaborator_role: 'Proveedor' },
]
const ids = list => list.map(party => party.id)

describe('filterDirectory', () => {
  it('treats records from before the migration as client companies', () => {
    expect(ids(filterDirectory(parties, { relation: 'clients' }))).toEqual(['legacy', 'both'])
    expect(ids(filterDirectory(parties, { legalForm: 'company' }))).toEqual(['legacy', 'both'])
  })
  it('combines relationship and legal form', () => {
    expect(ids(filterDirectory(parties, { relation: 'collaborators' }))).toEqual(['photo', 'both'])
    expect(ids(filterDirectory(parties, { relation: 'collaborators', legalForm: 'individual' }))).toEqual(['photo'])
  })
  it('searches names and specialities without accents and tax IDs without separators', () => {
    expect(ids(filterDirectory(parties, { search: 'lucia' }))).toEqual(['photo'])
    expect(ids(filterDirectory(parties, { search: 'fotograf' }))).toEqual(['photo'])
    expect(ids(filterDirectory(parties, { search: 'b12345' }))).toEqual(['legacy'])
  })
})

describe('partyToForm', () => {
  it('fills defaults for legacy rows', () => {
    expect(partyToForm(parties[0])).toMatchObject({ legal_form: 'company', is_client: true, is_collaborator: false, collaborator_role: '', notes: '' })
  })
})

describe('lastTwelveMonths', () => {
  it('returns twelve months ending in the current one, with zeros', () => {
    const months = lastTwelveMonths([{ month: '2026-11', total: '242.00' }, { month: '2025-01', total: 9 }], new Date('2026-11-21T10:00:00Z'))
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: '2025-12', total: 0 })
    expect(months[11]).toEqual({ month: '2026-11', total: 242 })
  })
})
