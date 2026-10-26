import { describe, expect, it, vi } from 'vitest'
import { formatContactTimelineDate, mergeContactTimeline } from './crmTimeline'

describe('unified CRM contact timeline', () => {
  it('merges form activities and linked billing documents by their business dates', () => {
    const entries = mergeContactTimeline(
      [{ id: 'activity-1', kind: 'form', title: 'Solicitud recibida', details: 'Reforma', occurred_at: '2026-10-25T10:00:00.000Z' }],
      [
        { id: 'link-1', document_kind: 'invoice', number: 'F-002', status: 'issued', linked_at: '2026-10-26T10:00:00.000Z', document: { date: '2026-10-24', presentation: { title: 'Obra' } } },
        { id: 'link-2', document_kind: 'quote', number: 'P-001', status: 'accepted', linked_at: '2026-10-25T11:00:00.000Z', document: { date: null, lines: [{ description: 'Pintura' }] } },
      ],
    )

    expect(entries.map(entry => entry.id)).toEqual(['billing:link-2', 'activity:activity-1', 'billing:link-1'])
    expect(entries[0]).toMatchObject({ type: 'billing', kind: 'quote', title: 'P-001', details: 'Pintura' })
    expect(entries[2]).toMatchObject({ type: 'billing', kind: 'invoice', date: '2026-10-24', details: 'Obra' })
  })

  it('formats date-only document dates without shifting the calendar day', () => {
    const formatter = vi.fn(value => `timestamp:${value}`)
    expect(formatContactTimelineDate('2026-10-24', formatter)).toBe('24/10/2026')
    expect(formatter).not.toHaveBeenCalled()
    expect(formatContactTimelineDate('2026-10-24T18:30:00.000Z', formatter)).toBe('timestamp:2026-10-24T18:30:00.000Z')
    expect(formatter).toHaveBeenCalledTimes(1)
  })
})
