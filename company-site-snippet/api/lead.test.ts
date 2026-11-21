import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(),rpc:vi.fn(), moduleEnabled: true, moduleConfigured: true }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: db.from,rpc:db.rpc }),
}))

const COMPANY_A = '123e4567-e89b-42d3-a456-426614174000'
const COMPANY_B = '223e4567-e89b-42d3-a456-426614174000'

async function loadHandler() {
  vi.resetModules()
  return (await import('./lead')).default
}

function request(companyId: string, fields: Record<string, unknown> = {}) {
  return new Request('https://client.example/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json','x-vercel-forwarded-for':'192.0.2.1' },
    body: JSON.stringify({ company_id: companyId, name: 'Ada', email: 'ada@example.test', ...fields }),
  })
}

describe('public lead endpoint tenant isolation', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example.test')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
    vi.stubEnv('VITE_COMPANY_ID', COMPANY_A)
    vi.stubEnv('VERCEL','1')
    vi.stubEnv('LEADS_RATE_LIMIT_SECRET','test-secret-at-least-32-characters-long')
    db.rpc.mockReset().mockResolvedValue({data:true,error:null})
    db.from.mockReset()
    db.insert.mockReset().mockResolvedValue({ error: null })
    db.moduleEnabled = true
    db.moduleConfigured = true
    db.from.mockImplementation((table: string) => {
      if (table === 'companies') return { select: () => ({ eq: (_field: string, id: string) => ({ maybeSingle: async () => ({ data: { id } }) }) }) }
      if (table === 'company_modules') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.moduleConfigured ? { is_enabled: db.moduleEnabled } : null, error: null }) }) }) }) }
      if (table === 'lead') return { insert: db.insert }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('does not insert on quota exhaustion and provides a retry response',async()=>{
    db.rpc.mockResolvedValue({data:false,error:null})
    const response=await (await loadHandler())(request(COMPANY_A))
    expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('3600')
    expect(db.insert).not.toHaveBeenCalled()
  })
  it('keeps the same server-derived key when form fields or user agent change',async()=>{
    const handler=await loadHandler()
    await handler(request(COMPANY_A))
    const modified=request(COMPANY_A,{name:'Other',email:'other@example.test',phone:'111'})
    modified.headers.set('user-agent','Different agent');modified.headers.set('x-forwarded-for','203.0.113.77')
    await handler(modified)
    expect(db.rpc.mock.calls[0]).toEqual(db.rpc.mock.calls[1])
    expect(db.rpc.mock.calls[0][1]).toEqual({p_company:COMPANY_A,p_client_key:expect.stringMatching(/^[0-9a-f]{64}$/)})
  })
  it('normalizes equivalent IPs and IPv6 networks and does not trust other address headers',async()=>{
    const {leadClientKey}=await import('./lead')
    const secret='test-only'
    const key=(ip:string)=>leadClientKey(new Headers({'x-vercel-forwarded-for':ip}),COMPANY_A,secret,'1')
    expect(key('192.0.2.1')).toBe(key('::ffff:192.0.2.1'))
    expect(key('2001:db8:1:2::1')).toBe(key('2001:0db8:0001:0002:0:0:0:99'))
    expect(key('2001:db8:1:3::1')).not.toBe(key('2001:db8:1:2::1'))
    expect(leadClientKey(new Headers({'x-forwarded-for':'192.0.2.1'}),COMPANY_A,secret,'1')).toBeNull()
  })
  it('fails closed on missing secret, untrusted hosting, address or rate backend errors',async()=>{
    const handler=await loadHandler()
    vi.stubEnv('LEADS_RATE_LIMIT_SECRET','short')
    expect((await handler(request(COMPANY_A))).status).toBe(503)
    vi.stubEnv('LEADS_RATE_LIMIT_SECRET','test-secret-at-least-32-characters-long');vi.stubEnv('VERCEL','')
    expect((await handler(request(COMPANY_A))).status).toBe(503)
    vi.stubEnv('VERCEL','1');const missing=request(COMPANY_A);missing.headers.delete('x-vercel-forwarded-for')
    expect((await handler(missing)).status).toBe(503)
    db.rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}})
    expect((await handler(request(COMPANY_A))).status).toBe(503)
    expect(db.insert).not.toHaveBeenCalled()
  })
  it('bounds streamed request bodies and rejects null/array JSON without database access',async()=>{
    const handler=await loadHandler()
    for(const body of ['x'.repeat(16385),'null','[]']){
      const response=await handler(new Request('https://client.example/api/lead',{method:'POST',body}))
      expect([400,413]).toContain(response.status)
    }
    expect(db.from).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled()
  })

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

  it('stores consent only with its text version and preserves attribution', async () => {
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A, {
      consent_given: true,
      consent_text_version: 'privacy-2026-10',
      source_path: '/contacto',
      source_item: 'Casa del Mar · listing-42',
      source_referrer: 'https://campaign.example/landing',
      source_utm_source: 'newsletter',
      source_utm_medium: 'email',
      source_campaign: 'otoño',
      source_utm_term: 'reforma',
      source_utm_content: 'hero-form',
    }))

    expect(response.status).toBe(201)
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      company_id: COMPANY_A,
      consent_given: true,
      consent_text_version: 'privacy-2026-10',
      consent_source: 'public_contact_form',
      consent_at: expect.any(String),
      source_path: '/contacto',
      source_item: 'Casa del Mar · listing-42',
      source_referrer: 'https://campaign.example/landing',
      source_utm_source: 'newsletter',
      source_utm_medium: 'email',
      source_campaign: 'otoño',
      source_utm_term: 'reforma',
      source_utm_content: 'hero-form',
    }))
  })

  it('does not record consent without a version of the text', async () => {
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A, { consent_given: true }))

    expect(response.status).toBe(201)
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      consent_given: false,
      consent_at: null,
      consent_text_version: null,
      consent_source: null,
    }))
  })

  it('limits the optional source item to a short public label', async () => {
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A, { source_item: ` ${'x'.repeat(250)} ` }))

    expect(response.status).toBe(201)
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ source_item: 'x'.repeat(200) }))
  })

  it('fails closed when the company has disabled CRM requests', async () => {
    db.moduleEnabled = false
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A))

    expect(response.status).toBe(503)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('fails closed when the company module row is missing', async () => {
    db.moduleConfigured = false
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A))

    expect(response.status).toBe(503)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('acknowledges a filled honeypot without touching Supabase', async () => {
    const handler = await loadHandler()
    const response = await handler(request(COMPANY_A, { company_website: 'https://spam.example' }))

    expect(response.status).toBe(200)
    expect(db.from).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })
})
