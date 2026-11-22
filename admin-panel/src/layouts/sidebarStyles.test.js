import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8')

function declarationsFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = appCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  return match?.[1] ?? ''
}

describe('collapsed sidebar layout', () => {
  it('keeps the collapsed menu at its declared width without horizontal overflow', () => {
    expect(declarationsFor('.sidebar')).toMatch(/box-sizing:\s*border-box/)
    expect(declarationsFor('.sidebar.collapsed')).toMatch(/overflow-x:\s*hidden/)
    expect(declarationsFor('.sidebar.collapsed .sidebar-nav')).toMatch(/overflow-x:\s*hidden/)
  })

  it('never scrolls the expanded menu sideways: long labels wrap', () => {
    expect(appCss).toMatch(/\.sidebar-nav \{ gap: 1rem; overflow-x: hidden; \}/)
    expect(declarationsFor('.sidebar-nav .nav-label')).toMatch(/white-space:\s*normal/)
    expect(declarationsFor('.sidebar-nav .nav-label')).toMatch(/min-width:\s*0/)
  })
})
