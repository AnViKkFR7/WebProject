import { describe, expect, it } from 'vitest'
import { navKeyForPath, visibleNavGroups } from './navigation'
import { permissionsFor } from './permissions'

describe('navigation — título de la página en la topbar', () => {
  it('reconoce cada sección, también sus subrutas', () => {
    expect(navKeyForPath('/')).toBe('dashboard')
    expect(navKeyForPath('/items')).toBe('items')
    expect(navKeyForPath('/items/123')).toBe('items')
    expect(navKeyForPath('/profile/security')).toBe('profile')
    expect(navKeyForPath('/my-data')).toBe('myData')
    expect(navKeyForPath('/quotes')).toBe('quotes')
    expect(navKeyForPath('/invoicing')).toBe('invoicing')
  })

  it('no confunde prefijos ni inventa títulos', () => {
    expect(navKeyForPath('/itemsx')).toBeNull()
    expect(navKeyForPath('/no-existe')).toBeNull()
  })
})

describe('navigation — menú según rol', () => {
  const groupKeys = (role, admin) => visibleNavGroups(permissionsFor(role, admin)).map((g) => g.key)

  it('un viewer no ve Administración', () => {
    expect(groupKeys('viewer')).toEqual(['main', 'content', 'operation'])
  })

  it('editor, admin de empresa y admin de plataforma sí', () => {
    expect(groupKeys('editor')).toContain('administration')
    expect(groupKeys('admin')).toContain('administration')
    expect(groupKeys(null, true)).toContain('administration')
  })
})
