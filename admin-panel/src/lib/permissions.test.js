import { describe, expect, it } from 'vitest'
import { isPlatformAdminUser, permissionsFor } from './permissions'

describe('permissions — la UI refleja la RLS', () => {
  it('un viewer no puede editar ni ve Administración', () => {
    const p = permissionsFor('viewer')
    expect(p.canEdit).toBe(false)
    expect(p.canSeeAdministration).toBe(false)
    expect(p.canAdministerPlatform).toBe(false)
    expect(p.canManageMemberAccess).toBe(false)
  })

  it('editor y admin de empresa editan, pero no administran módulos de plataforma', () => {
    for (const role of ['editor', 'admin']) {
      const p = permissionsFor(role)
      expect(p.canEdit).toBe(true)
      expect(p.canAdministerPlatform).toBe(false)
      expect(p.canManageMemberAccess).toBe(role === 'admin')
      expect(p.canManageModules).toBe(false)
    }
  })

  it('el admin de plataforma puede todo aunque no sea miembro de la empresa', () => {
    const p = permissionsFor(null, true)
    expect(p.canEdit).toBe(true)
    expect(p.canAdministerPlatform).toBe(true)
    expect(p.canManageModules).toBe(true)
  })

  it('sin empresa seleccionada no se ofrece editar', () => {
    expect(permissionsFor(undefined).canEdit).toBe(false)
  })

  it('usa el mismo claim que is_platform_admin() (app_role), no app_metadata.role', () => {
    // Companies.jsx miraba app_metadata.role / is_admin y nunca coincidía con la BD
    expect(isPlatformAdminUser({ app_metadata: { app_role: 'admin' } })).toBe(true)
    expect(isPlatformAdminUser({ app_metadata: { role: 'admin' } })).toBe(false)
    expect(isPlatformAdminUser(null)).toBe(false)
  })
})
