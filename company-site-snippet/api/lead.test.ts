import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: db.from }),
}))

const COMPANY_A = '123e4567-e89b-42d3-a456-426614174000'
const COMPANY_B = '223e4567-e89b-42d3-a456-426614174000'

async function loadHandler() {
  vi.resetModules()
  return (await import('./lead')).default
}

function request(companyId: string) {
  return new Request('https://client.example/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: companyId, name: 'Ada', email: 'ada@example.test' }),
  })
}

describe('public lead endpoint tenant isolation', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example.test')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
    vi.stubEnv('VITE_COMPANY_ID', COMPANY_A)
    db.from.mockReset()
    db.insert.mockReset().mockResolvedValue({ error: null })
    db.from.mockImplementation((table: string) => {
      if (table === 'companies') return { select: () => ({ eq: (_field: string, id: string) => ({ maybeSingle: async () => ({ data: { id } }) }) }) }
      if (table === 'company_modules') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_enabled: true }, error: null }) }) }) }) }
      if (table === 'lead') return { insert: db.insert }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects a body that targets a different company before any database access', async () => {
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_B))

    expect(response.status).toBe(400)
    expect(db.from).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('writes using the company configured for this deployment', async () => {
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A))

    expect(response.status).toBe(201)
    expect(db.from).toHaveBeenCalledWith('companies')
    expect(db.from).toHaveBeenCalledWith('company_modules')
    expect(db.from).toHaveBeenCalledWith('lead')
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ company_id: COMPANY_A }))
  })

  it('fails closed when the deployment has no valid company ID', async () => {
    vi.stubEnv('VITE_COMPANY_ID', '')
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A))

    expect(response.status).toBe(503)
    expect(db.from).not.toHaveBeenCalled()
  })
})
