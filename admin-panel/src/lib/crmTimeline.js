const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function toTimelineTime(value) {
  if (!value) return 0
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day, 12).getTime()
  }
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatContactTimelineDate(value, formatDateTime) {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }
  return formatDateTime(value)
}

export function mergeContactTimeline(activities = [], billingDocuments = []) {
  const activityEntries = activities.map(activity => ({
    type: 'activity',
    id: `activity:${activity.id}`,
    kind: activity.kind,
    title: activity.title,
    details: activity.details,
    date: activity.occurred_at,
    sortTime: toTimelineTime(activity.occurred_at),
  }))

  const billingEntries = billingDocuments.map(document => {
    const date = document.document?.date || document.linked_at
    return {
      type: 'billing',
      id: `billing:${document.id}`,
      linkId: document.id,
      kind: document.document_kind,
      title: document.number,
      details: document.document?.presentation?.title || document.document?.lines?.[0]?.description || '',
      status: document.status,
      date,
      linkedAt: document.linked_at,
      sortTime: toTimelineTime(date),
    }
  })

  return [...activityEntries, ...billingEntries].sort((left, right) =>
    right.sortTime - left.sortTime || right.id.localeCompare(left.id),
  )
}
