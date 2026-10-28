import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const root = new URL('../../', import.meta.url)
const page = readFileSync(new URL('src/pages/Contacts.jsx', root), 'utf8')
const styles = readFileSync(new URL('src/pages/Contacts.module.css', root), 'utf8')

it('uses one guided onboarding state instead of repeating empty cards in every pipeline stage', () => {
  expect(page).toContain('showInitialEmptyState ? <section className={styles.emptyPipeline}')
  expect(page).toContain('className={styles.stagePreview}')
  expect(page).not.toContain('board.contacts.length === 0 && board.reviews.length === 0 && <div className="card">')
  expect(styles).toContain('.emptyPipeline {')
  expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
})
