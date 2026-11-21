import { describe, expect, it } from 'vitest'
import { companySettingsTabs } from './companySettings'
import { permissionsFor } from './permissions'

const paths = (role, admin, modules) => companySettingsTabs(permissionsFor(role, admin), modules).map(tab => tab.path)

describe('ajustes de empresa — pestañas según permisos', () => {
  it('viewer y editor no tienen ajustes de empresa', () => {
    expect(paths('viewer')).toEqual([])
    expect(paths('editor')).toEqual([])
  })

  it('el admin de empresa gestiona emails y privacidad, pero no los módulos', () => {
    expect(paths('admin')).toEqual(['general', 'emails', 'privacy'])
  })

  it('solo el admin de plataforma ve Módulos', () => {
    expect(paths(null, true)).toEqual(['general', 'modules', 'emails', 'privacy'])
  })

  it('sin facturación no se ofrecen los emails a clientes', () => {
    expect(paths('admin', false, { billing: false })).toEqual(['general', 'privacy'])
  })
})
