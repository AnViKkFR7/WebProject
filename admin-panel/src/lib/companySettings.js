// Pestañas de «Ajustes de empresa». Cada página vuelve a comprobar el permiso y la base de datos
// lo impone con RLS/RPC; esto solo decide qué pestañas se ofrecen.
export const COMPANY_SETTINGS_TABS = [
  { path: 'general', key: 'general', allowed: (permissions) => permissions.canManagePrivacy },
  { path: 'modules', key: 'modules', allowed: (permissions) => permissions.canManageModules },
  { path: 'emails', key: 'emails', allowed: (permissions, modules) => permissions.canManagePrivacy && modules.billing !== false },
  { path: 'privacy', key: 'privacy', allowed: (permissions) => permissions.canManagePrivacy },
]

/** Pestañas visibles para estos permisos y módulos activos */
export const companySettingsTabs = (permissions, modules = {}) =>
  COMPANY_SETTINGS_TABS.filter(tab => tab.allowed(permissions, modules))
