import { supabase } from '../lib/supabaseClient'

const bytesToHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')

export function createQuoteApprovalToken() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) throw new Error('Secure browser cryptography is unavailable')
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)))
}

export async function hashQuoteApprovalToken(token) {
  if (!/^[0-9a-f]{64}$/.test(token || '') || !globalThis.crypto?.subtle) throw new Error('Invalid approval token')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return bytesToHex(new Uint8Array(digest))
}

export const quoteApprovalService = {
  async issue(companyId, quoteId, token, days = 30) {
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString()
    const tokenHash = await hashQuoteApprovalToken(token)
    const { data, error } = await supabase.rpc('issue_quote_approval_link', {
      p_company: companyId, p_quote: quoteId, p_token_hash: tokenHash, p_expires_at: expiresAt,
    })
    if (error) throw error
    return { expiresAt: data, url: `${window.location.origin}/quotes/respond#${token}` }
  },

  async details(token) {
    const tokenHash = await hashQuoteApprovalToken(token)
    const { data, error } = await supabase.rpc('get_quote_approval_details', { p_token_hash: tokenHash })
    if (error) throw error
    return data
  },

  async respond(token, decision, name, email, reason) {
    const tokenHash = await hashQuoteApprovalToken(token)
    const { data, error } = await supabase.rpc('respond_to_quote_approval', {
      p_token_hash: tokenHash, p_decision: decision, p_name: name, p_email: email, p_reason: reason || null,
    })
    if (error) throw error
    return data
  },

  async audit(companyId, quoteId) {
    const { data, error } = await supabase.rpc('get_quote_approval_audit', { p_company: companyId, p_quote: quoteId })
    if (error) throw error
    return data
  },
}
