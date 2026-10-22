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
      { to: '/items', key: 'items', icon: 'items' },
      { to: '/my-data', key: 'myData', icon: 'data' },
      { to: '/blog', key: 'blog', icon: 'blog' },
    ],
  },
  {
    key: 'operation',
    items: [
      { to: '/leads', key: 'leads', icon: 'mail' },
      { to: '/planning', key: 'planning', icon: 'planning' },
      { to: '/quotes', key: 'quotes', icon: 'file' },
      { to: '/invoicing', key: 'invoicing', icon: 'file' },
      { to: '/analytics', key: 'analytics', icon: 'analytics' },
    ],
  },
  {
    key: 'administration',
    requires: 'canSeeAdministration',
    items: [
      { to: '/users', key: 'users', icon: 'users' },
      { to: '/companies', key: 'companies', icon: 'companies' },
    ],
  },
]

const EXTRA_TITLES = [
  { to: '/profile', key: 'profile' },
  { to: '/privacy-policy', key: 'privacyPolicy' },
  { to: '/legal-notice', key: 'legalNotice' },
  { to: '/cookies-policy', key: 'cookiesPolicy' },
]

/** Grupos visibles según permisos */
export const visibleNavGroups = (permissions) =>
  NAV_GROUPS.filter((group) => !group.requires || permissions[group.requires])

const matches = (pathname, to) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)

/** Clave de `nav.*` para el título de la página actual, o null si no se conoce */
export function navKeyForPath(pathname) {
  const all = [...NAV_GROUPS.flatMap((group) => group.items), ...EXTRA_TITLES]
  return all.find((item) => matches(pathname, item.to))?.key ?? null
}
