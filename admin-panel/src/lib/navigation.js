// Estructura del menú lateral. La usa también la topbar para titular la página.
// `requires` es una clave de permissionsFor(): el grupo se oculta si es false.
export const NAV_GROUPS = [
  {
    key: 'main',
    items: [{ to: '/', key: 'dashboard', icon: 'dashboard' }],
  },
  {
    key: 'content',
    items: [
      { to: '/items', key: 'items', icon: 'items', module: 'items' },
      { to: '/my-data', key: 'myData', icon: 'data', module: 'items' },
      { to: '/blog', key: 'blog', icon: 'blog', module: 'blog' },
    ],
  },
  {
    key: 'operation',
    items: [
      { to: '/leads', key: 'leads', icon: 'mail', module: 'crm' },
      { to: '/contacts', key: 'contacts', icon: 'users', module: 'crm' },
      { to: '/planning', key: 'planning', icon: 'planning', module: 'planning' },
      { to: '/quotes', key: 'quotes', icon: 'file', module: 'billing' },
      { to: '/invoicing', key: 'invoicing', icon: 'file', module: 'billing' },
      { to: '/analytics', key: 'analytics', icon: 'analytics', module: 'analytics' },
    ],
  },
  {
    key: 'administration',
    requires: 'canSeeAdministration',
    items: [
      { to: '/users', key: 'users', icon: 'users' },
      { to: '/companies', key: 'companies', icon: 'companies' },
      { to: '/settings/modules', key: 'modules', icon: 'grid', requires: 'canManageModules' },
      { to: '/settings/privacy', key: 'privacy', icon: 'lock', requires: 'canManagePrivacy' },
      { to: '/settings/emails', key: 'emailSettings', icon: 'mail', requires: 'canManagePrivacy', module: 'billing' },
    ],
  },
]

const EXTRA_TITLES = [
  { to: '/profile', key: 'profile' },
  { to: '/privacy-policy', key: 'privacyPolicy' },
  { to: '/legal-notice', key: 'legalNotice' },
  { to: '/cookies-policy', key: 'cookiesPolicy' },
  { to: '/settings/emails', key: 'emailSettings' },
]

/** Grupos visibles según permisos */
export const visibleNavGroups = (permissions, enabledModules = {}) => NAV_GROUPS
  .filter((group) => !group.requires || permissions[group.requires])
  .map(group => ({ ...group, items: group.items.filter(item =>
    (!item.module || enabledModules[item.module] !== false) && (!item.requires || permissions[item.requires])
  ) }))
  .filter(group => group.key === 'main' || group.items.length > 0)

const matches = (pathname, to) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)

/** Clave de `nav.*` para el título de la página actual, o null si no se conoce */
export function navKeyForPath(pathname) {
  const all = [...NAV_GROUPS.flatMap((group) => group.items), ...EXTRA_TITLES]
  return all.find((item) => matches(pathname, item.to))?.key ?? null
}
