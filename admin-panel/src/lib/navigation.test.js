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
    expect(navKeyForPath('/settings')).toBe('companySettings')
    expect(navKeyForPath('/settings/modules')).toBe('companySettings')
    expect(navKeyForPath('/settings/emails')).toBe('companySettings')
    expect(navKeyForPath('/settingsx')).toBeNull()
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

  it('agrupa los ajustes de empresa en una sola entrada, solo para administradores', () => {
    const links = (role, admin, modules) => visibleNavGroups(permissionsFor(role, admin), modules).flatMap(group => group.items).map(item => item.to)
    expect(links('editor', false, { billing: false })).not.toContain('/settings')
    expect(links('editor', false, { billing: false })).not.toContain('/invoicing')
    expect(links('admin', false, { billing: false })).toContain('/settings')
    expect(links(null, true, { billing: false })).toContain('/settings')
    for (const old of ['/settings/modules', '/settings/privacy', '/settings/emails']) {
      expect(links(null, true)).not.toContain(old)
    }
  })
})

it.each([[true,false,true],[false,true,true],[true,true,true],[false,false,false]])('client directory navigation: billing=%s, planning=%s, visible=%s',(billing,planning,visible)=>{
  const links=visibleNavGroups(permissionsFor('editor'),{billing,planning}).flatMap(group=>group.items)
  expect(links.some(item=>item.to==='/companies')).toBe(visible)
  expect(links.some(item=>item.to==='/planning')).toBe(planning)
  expect(links.some(item=>item.to==='/invoicing')).toBe(billing)
})
