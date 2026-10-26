// Refleja en la interfaz lo que la RLS ya impone (DB_SCHEMA.sql): la seguridad
// sigue en la base de datos; esto solo evita ofrecer botones que van a fallar.

export const ROLES = ['admin', 'editor', 'viewer']

/** Admin de plataforma: mismo claim que public.is_platform_admin() */
export const isPlatformAdminUser = (user) => user?.app_metadata?.app_role === 'admin'

/**
 * @param {string|null} role  rol del usuario en la empresa seleccionada
 * @param {boolean} isPlatformAdmin
 */
export function permissionsFor(role, isPlatformAdmin = false) {
  const isCompanyAdmin = isPlatformAdmin || role === 'admin'
  const canEdit = isCompanyAdmin || role === 'editor'
  return {
    role: role ?? null,
    isPlatformAdmin,
    canEdit,
    canManageMembers: canEdit,
    canManageMemberAccess: isCompanyAdmin,
    canManageModules: isPlatformAdmin,
    canManagePrivacy: isCompanyAdmin,
    // Crear empresas y dar de alta usuarios pasa por Edge Functions solo para admin de plataforma
    canAdministerPlatform: isPlatformAdmin,
    // Los viewers no ven el grupo Administración: no pueden cambiar nada en él
    canSeeAdministration: canEdit,
  }
}
