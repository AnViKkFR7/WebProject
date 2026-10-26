import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { webcrypto } from 'node:crypto'

const { rpc } = vi.hoisted(() => ({ rpc:vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({ supabase:{ rpc } }))
import { createQuoteApprovalToken,hashQuoteApprovalToken,quoteApprovalService } from './quoteApprovalService'

beforeEach(()=>{ rpc.mockReset(); vi.stubGlobal('crypto',webcrypto); vi.stubGlobal('window',{location:{origin:'https://admin.example.test'}}) })
afterEach(()=>vi.unstubAllGlobals())

describe('quote approval links',()=>{
  it('creates high-entropy hex tokens and hashes them for persistence',async()=>{
    const token=createQuoteApprovalToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const hash=await hashQuoteApprovalToken(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashQuoteApprovalToken(token)).toBe(hash)
    await expect(hashQuoteApprovalToken('short')).rejects.toThrow('Invalid approval token')
  })

  it('sends only the token hash to the issuance RPC and keeps the bearer in the URL fragment',async()=>{
    rpc.mockResolvedValue({data:'2026-11-25T12:00:00Z',error:null})
    const token='a'.repeat(64)
    const result=await quoteApprovalService.issue('company','quote',token)
    expect(result).toEqual({expiresAt:'2026-11-25T12:00:00Z',url:`https://admin.example.test/quotes/respond#${token}`})
    expect(rpc).toHaveBeenCalledWith('issue_quote_approval_link',expect.objectContaining({p_company:'company',p_quote:'quote',p_token_hash:await hashQuoteApprovalToken(token)}))
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_token')
  })

  it('passes declared identity and decision through the public response RPC',async()=>{
    rpc.mockResolvedValue({data:{decision:'rejected'},error:null})
    const result=await quoteApprovalService.respond('b'.repeat(64),'rejected','Ana','ana@example.test','Plazo no válido')
    expect(result.decision).toBe('rejected')
    expect(rpc).toHaveBeenCalledWith('respond_to_quote_approval',expect.objectContaining({p_decision:'rejected',p_name:'Ana',p_email:'ana@example.test',p_reason:'Plazo no válido'}))
  })
})
