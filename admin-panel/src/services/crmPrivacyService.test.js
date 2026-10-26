import { beforeEach, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc: (...args) => rpc(...args) } }))
const { crmPrivacyService } = await import('./crmPrivacyService')

beforeEach(() => rpc.mockReset())

it('keeps each privacy operation explicitly scoped to its company and selected contact', async () => {
  rpc.mockResolvedValue({ data: [], error: null })
  await crmPrivacyService.searchContacts('company-a', 'Ana')
  expect(rpc).toHaveBeenLastCalledWith('list_crm_privacy_contacts', { p_company: 'company-a', p_query: 'Ana' })
  await crmPrivacyService.preview('company-a', 'contact-a')
  expect(rpc).toHaveBeenLastCalledWith('preview_crm_contact_anonymization', { p_company: 'company-a', p_contact: 'contact-a' })
  await crmPrivacyService.exportContact('company-a', 'contact-a')
  expect(rpc).toHaveBeenLastCalledWith('export_crm_contact', { p_company: 'company-a', p_contact: 'contact-a' })
  await crmPrivacyService.anonymize('company-a', 'contact-a', 'request-a')
  expect(rpc).toHaveBeenLastCalledWith('anonymize_crm_contact', { p_company: 'company-a', p_contact: 'contact-a', p_request: 'request-a' })
  await crmPrivacyService.getRetentionReview('company-a')
  expect(rpc).toHaveBeenLastCalledWith('get_crm_retention_review', { p_company: 'company-a' })
  await crmPrivacyService.saveRetentionReview('company-a', 180, null)
  expect(rpc).toHaveBeenLastCalledWith('save_crm_retention_review_settings', {
    p_company: 'company-a', p_unresolved_lead_days: 180, p_inactive_contact_days: null,
  })
})

it('propagates server failures so the interface can preserve the request for retry', async () => {
  const error = new Error('temporarily unavailable')
  rpc.mockResolvedValue({ data: null, error })
  await expect(crmPrivacyService.exportContact('company-a', 'contact-a')).rejects.toBe(error)
})
