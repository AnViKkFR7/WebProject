import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = new URL('../../../database/migrations/', import.meta.url)
const readme = readFileSync(new URL('../../../database/README.md', import.meta.url), 'utf8')
const retentionPreflight = readFileSync(new URL('../../../database/maintenance/CRM_RETENTION_REVIEW_PREFLIGHT.sql', import.meta.url), 'utf8')
const orderedSection = readme.split('## Orden de ejecución en una base de datos nueva')[1]?.split('## Migraciones')[0] || ''

describe('database migration runbook', () => {
  it('documents every migration file in the repository', () => {
    const files = readdirSync(migrationsDirectory).filter(file => file.endsWith('.sql'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) expect(readme).toContain(`migrations/${file}`)
  })

  it('places module gates after their Planning and billing dependencies', () => {
    const position = file => orderedSection.indexOf(`migrations/${file}`)
    const ordered = [
      'PLANNING_TASK_MOVE_UNDO.sql',
      'PLANNING_EMAIL_QUEUE.sql',
      'CRM_CONTACTS_PIPELINE.sql',
      'CRM_REVIEW_ACTIVITY_LINK.sql',
      'CRM_PRIVACY_CONTROLS.sql',
      'INVOICING.sql',
      'BILLING_DRAFTS.sql',
      'BILLING_CHAPTER_TEMPLATES.sql',
      'BILLING_PAYMENTS_HISTORY.sql',
      'BILLING_RECTIFYING_INVOICES.sql',
      'CRM_BILLING_LINKS.sql',
      'CRM_RETENTION_REVIEW.sql',
      'COMPANY_MODULES.sql',
      'COMPANY_MODULES_PLATFORM_ADMIN.sql',
      'BILLING_DUE_REMINDERS.sql',
      'WEEKLY_SUMMARY_EMAIL.sql',
      'WEEKLY_SUMMARY_EMAIL_AUTOMATIC.sql',
      'BILLING_DUE_REMINDERS_CRON.sql',
    ].map(position)

    expect(ordered.every(index => index >= 0)).toBe(true)
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b))
  })

  it('keeps the Planning cron step after deployment guidance', () => {
    const deployPosition = orderedSection.indexOf('desplegar `send-planning-reminders`')
    const cronPosition = orderedSection.lastIndexOf('Parte B** de `migrations/PLANNING_REMINDERS.sql`')
    expect(deployPosition).toBeGreaterThanOrEqual(0)
    expect(cronPosition).toBeGreaterThan(deployPosition)
  })

  it('keeps the CRM retention preflight read-only and free of personal data', () => {
    expect(retentionPreflight).not.toMatch(/\b(insert\s+into|update\s+\w|delete\s+from|truncate|drop\s+|alter\s+table)\b/i)
    expect(retentionPreflight).not.toMatch(/email|phone|customer_name|message\s*,/i)
    expect(readme).toContain('maintenance/CRM_RETENTION_REVIEW_PREFLIGHT.sql')
  })
})
