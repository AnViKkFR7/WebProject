// Generate shareable previews from the exact Edge renderer, with synthetic data.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../admin-panel/package.json', import.meta.url))
const { transform } = require('esbuild')
const source = await readFile(new URL('../supabase/functions/_shared/weeklySummary.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { buildWeeklySummaryEmail } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const directory = new URL('../docs/previews/', import.meta.url)
await mkdir(directory, { recursive: true })
const base = {
  week_start: '2026-10-19', week_end: '2026-10-25', recipient_emails: [],
  new_leads: 12, new_contacts: 8, overdue_followups: 2, issued_invoices: 6,
  overdue_invoices: 1, quotes_waiting: 4, upcoming_planning: 7, page_views: 1842,
}
for (const [file, payload] of [
  ['weekly-summary.html', base],
  ['weekly-summary-quiet.html', { ...base, new_leads: 0, new_contacts: 0, overdue_followups: 0, issued_invoices: 0, overdue_invoices: 0, quotes_waiting: 0, upcoming_planning: 0, page_views: 0 }],
]) {
  const { html } = buildWeeklySummaryEmail(payload)
  await writeFile(new URL(file, directory), html, 'utf8')
  await writeFile(new URL(`../admin-panel/${file.replace('.html', '-preview.local.html')}`, import.meta.url), html, 'utf8')
  process.stdout.write(`Generated docs/previews/${file}\n`)
}
