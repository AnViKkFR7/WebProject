import { afterEach, expect, it, vi } from 'vitest'
import { reportOperationalFailure } from './operationalTelemetry'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('logs safe operational metadata without error messages or identifying payloads', () => {
  vi.stubEnv('VITE_DEPLOYMENT_ENV', 'production')
  vi.stubEnv('VITE_APP_VERSION', '2026.10.26+abc123')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const privateError = new Error('user@example.com invoice INV-123 secret-token')

  reportOperationalFailure('billing', 'pdf_generation_failed', privateError)

  expect(log).toHaveBeenCalledOnce()
  expect(log.mock.calls[0][0]).toBe('[ADMIN_OPS]')
  expect(log.mock.calls[0][1]).toMatchObject({
    event: 'operation_failed',
    scope: 'billing',
    code: 'pdf_generation_failed',
    environment: 'production',
    version: '2026.10.26+abc123',
    errorType: 'Error',
  })
  expect(JSON.stringify(log.mock.calls)).not.toContain('user@example.com')
  expect(JSON.stringify(log.mock.calls)).not.toContain('INV-123')
  expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token')
})

it('rejects dynamic scope, code, environment, and version values', () => {
  vi.stubEnv('VITE_DEPLOYMENT_ENV', 'production; user@example.com')
  vi.stubEnv('VITE_APP_VERSION', 'user@example.com')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})

  reportOperationalFailure('user@example.com', 'invoice INV-1 failed', new Error('private'))

  expect(log.mock.calls[0][1]).toMatchObject({
    scope: 'unknown',
    code: 'unknown',
    environment: 'test',
    version: 'unversioned',
    errorType: 'Error',
  })
  expect(JSON.stringify(log.mock.calls)).not.toContain('user@example.com')
  expect(JSON.stringify(log.mock.calls)).not.toContain('INV-1')
  expect(JSON.stringify(log.mock.calls)).not.toContain('user@example.com')
})
