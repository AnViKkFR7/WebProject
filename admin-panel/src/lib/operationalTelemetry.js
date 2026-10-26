const scopes = new Set(['billing', 'users'])
const codes = new Set([
  'document_save_failed',
  'document_cancel_failed',
  'pdf_generation_failed',
  'billing_profile_save_failed',
  'document_conversion_failed',
  'billing_default_save_failed',
  'user_create_failed',
  'user_invite_failed',
  'user_list_failed',
  'admin_role_check_failed',
])
const errorTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'DOMException', 'AbortError', 'TimeoutError'])
const environments = new Set(['development', 'local', 'test', 'ci', 'staging', 'production', 'preview'])

const buildMetadata = (value, allowed, fallback) => allowed.has(value) ? value : fallback
const buildVersion = value => typeof value === 'string' && /^[a-zA-Z0-9._+-]{1,40}$/.test(value) ? value : 'unversioned'

/** Log only stable operational metadata. Never include the error, payload, URL, IDs, or stack. */
export function reportOperationalFailure(scope, code, error) {
  const environment = buildMetadata(
    import.meta.env.VITE_DEPLOYMENT_ENV,
    environments,
    buildMetadata(import.meta.env.MODE, environments, 'unknown')
  )
  const record = {
    event: 'operation_failed',
    scope: scopes.has(scope) ? scope : 'unknown',
    code: codes.has(code) ? code : 'unknown',
    environment,
    version: buildVersion(import.meta.env.VITE_APP_VERSION),
    errorType: errorTypes.has(error?.name) ? error.name : 'Error',
    occurredAt: new Date().toISOString(),
  }

  console.error('[ADMIN_OPS]', record)
}
