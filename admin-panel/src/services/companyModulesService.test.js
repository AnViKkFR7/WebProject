import { afterEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc } }))

import { companyModulesService } from './companyModulesService'

describe('companyModulesService', () => {
  afterEach(() => vi.clearAllMocks())

  it('changes a module only through the platform-admin RPC', async () => {
    rpc.mockResolvedValue({ data: { module_key: 'crm', is_enabled: false }, error: null })

    await expect(companyModulesService.setEnabled('company-a', 'crm', false)).resolves.toMatchObject({ is_enabled: false })
    expect(rpc).toHaveBeenCalledWith('set_company_module', {
      p_company: 'company-a',
      p_module_key: 'crm',
      p_is_enabled: false,
    })
  })
})
