import { describe, expect, it, vi } from 'vitest'
import { downloadInvoicePDF } from './invoicePdf'
import { escapeHtml } from './safeHtml'
describe('legacy planning printing prevents stored HTML injection', () => {
  it('escapes customer names, concepts, descriptions and amounts before document.write', () => {
    const write=vi.fn(); const close=vi.fn()
    vi.stubGlobal('window',{ open:vi.fn(()=>({ document:{ write,close } })) })
    try {
      downloadInvoicePDF({ id:'123',client_company_id:'client',direction:'cobrar',title:'<img src=x onerror=alert(1)>',description:'</div><script>steal()</script>',amount:'<svg onload=steal()>',billing_date:'<iframe>' },[{ id:'client',name:'<script>company()</script>' }],key=>key,vi.fn())
      const html=write.mock.calls[0][0]
      expect(html).not.toContain('<script>steal()')
      expect(html).not.toContain('<script>company()')
      expect(html).not.toContain('<img src=x')
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
      expect(html).toContain('&lt;svg onload=steal()&gt;')
      expect(html).toContain('window.print()')
      expect(close).toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('escapes quotes and apostrophes as well as tags', () => {
    expect(escapeHtml(`"'&<>`)).toBe('&quot;&#39;&amp;&lt;&gt;')
  })
})
