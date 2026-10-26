import { afterEach, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase: { from } }))

import { crmService } from './crmService'

const selectedColumns = []
let pendingReview

function queryBuilder(table) {
  const builder = {
    select(columns) {
      selectedColumns.push({ table, columns })
      return builder
    },
    eq() { return builder },
    order() { return builder },
    limit() { return builder },
    then(resolve, reject) {
      const data = table === 'lead' && pendingReview ? [pendingReview] : []
      return Promise.resolve({ data, error: null }).then(resolve, reject)
    },
  }
  return builder
}

afterEach(() => {
  from.mockReset()
  selectedColumns.length = 0
  pendingReview = null
})

it('loads source_item in ambiguous lead reviews so the agent can identify the item', async () => {
  pendingReview = { id: 'lead-1', source_item: 'Casa del Mar · casa-del-mar' }
  from.mockImplementation(queryBuilder)

  const board = await crmService.getBoard('company-1')

  expect(selectedColumns.find(query => query.table === 'lead').columns).toContain('source_item')
  expect(board.reviews).toEqual([pendingReview])
})
