import { describe,expect,it } from 'vitest'
import {defaultCustomerEmailSettings,renderCustomerBillingEmail,resolveCustomerEmailLanguage,sanitizeCustomerEmailHtml} from './customerEmailTemplate'

describe('customer billing email templates',()=>{
  it('uses Spanish by default and safely resolves the company delivery language',()=>{
    const settings=defaultCustomerEmailSettings()
    expect(settings.brand.emailLanguage).toBe('es')
    expect(resolveCustomerEmailLanguage(settings.brand)).toBe('es')
    expect(resolveCustomerEmailLanguage({emailLanguage:'en'})).toBe('en')
    expect(resolveCustomerEmailLanguage({emailLanguage:'fr'})).toBe('es')
  })

  it('wraps quote email with visible company sender and MoiraOrdo attribution',()=>{
    const settings=defaultCustomerEmailSettings()
    const message=renderCustomerBillingEmail({kind:'quote_approval',companyName:'Taller Norte',data:{customer_name:'Ada',quote_number:'P-12',approval_url:'https://panel.example/quotes/respond#token',expires_at:'30/10/2026'},brand:settings.brand,template:settings.templates.quote_approval.es})
    expect(message.subject).toBe('Presupuesto P-12 · Taller Norte')
    expect(message.preheader).toContain('Taller Norte')
    expect(message.html.indexOf('Este mensaje te lo envía Taller Norte')).toBeLessThan(message.html.indexOf('Ada'))
    expect(message.html).toContain('Recurso digital powered by <a href="https://www.moiraordo.es"')
    expect(message.html).toContain('href="https://panel.example/quotes/respond#token" role="button"')
    expect(message.html).toContain('border-radius:30px;background:#334155')
    expect(message.html).toContain('Tu propuesta está lista')
    expect(message.html).toContain('background-color:#f1f3f5')
    expect(message.html.match(/Este mensaje te lo envía/g)).toHaveLength(1)
    expect(message.html).not.toContain('Te enviamos el presupuesto')
    expect(message.text).toContain('MoiraOrdo (https://www.moiraordo.es)')
    expect(message.text).toContain('Ada')
  })

  it('escapes placeholder text and creates invoice due emails in English',()=>{
    const settings=defaultCustomerEmailSettings()
    const message=renderCustomerBillingEmail({kind:'invoice_due',language:'en',companyName:'North & Co',data:{invoice_number:'F-1',due_date:'26 October 2026',balance:'€20.00'},brand:settings.brand,template:settings.templates.invoice_due.en})
    expect(message.subject).toContain('F-1')
    expect(message.html).toContain('North &amp; Co')
    expect(message.html).toContain('outstanding balance')
    expect(message.html).toContain('lang="en"')
  })

  it('accepts only basic email-safe markup and safe links',()=>{
    expect(sanitizeCustomerEmailHtml('<p><strong>Hello</strong></p>')).toBe('<p><strong>Hello</strong></p>')
    expect(()=>sanitizeCustomerEmailHtml('<script>alert(1)</script>')).toThrow()
    expect(()=>sanitizeCustomerEmailHtml('<p onclick="alert(1)">Hello</p>')).toThrow()
    expect(()=>sanitizeCustomerEmailHtml('<a href="javascript:alert(1)">Open</a>')).toThrow()
    expect(()=>sanitizeCustomerEmailHtml('<img src="https://evil.example/x">')).toThrow()
  })

  it('rejects unknown and malformed placeholders instead of sending them literally',()=>{
    const settings=defaultCustomerEmailSettings()
    const template={...settings.templates.invoice_due.es,subject:'Invoice {{unexpected_value}}'}
    expect(()=>renderCustomerBillingEmail({kind:'invoice_due',companyName:'Company',brand:settings.brand,template})).toThrow('Unsupported email placeholder')
    expect(()=>renderCustomerBillingEmail({kind:'invoice_due',companyName:'Company',brand:settings.brand,template:{...template,subject:'Invoice {{bad-name}}'}})).toThrow('Malformed email placeholder')
  })

  it('embeds valid company logos as CID attachments and uses the selected layout colors',()=>{
    const settings=defaultCustomerEmailSettings()
    const logo='data:image/png;base64,iVBORw0KGgo='
    const message=renderCustomerBillingEmail({kind:'invoice_due',companyName:'Company',data:{invoice_number:'F-1',due_date:'01/01/2027',balance:'5 €'},brand:{...settings.brand,layout:'bold',logo,palette:{...settings.brand.palette,accent:'#0f766e'}},template:settings.templates.invoice_due.es})
    expect(message.attachments).toEqual([{filename:'company-logo.png',content:'iVBORw0KGgo=',content_id:'company-email-logo',content_type:'image/png'}])
    expect(message.html).toContain('src="cid:company-email-logo"')
    expect(message.html).toContain('max-width:72px;max-height:48px;height:auto;object-fit:contain')
    expect(message.html).toContain('table-layout:fixed')
    expect(message.html).toContain('overflow-wrap:anywhere;word-break:break-word')
    expect(message.html).toContain('role="presentation"')
    expect(message.html).toContain('background:#0f766e')
  })

  it('shows the selected logo in preview without a CID attachment and distinguishes layouts',()=>{
    const settings=defaultCustomerEmailSettings()
    const logo='data:image/png;base64,iVBORw0KGgo='
    const shared={kind:'invoice_due',companyName:'Company',data:{invoice_number:'F-1',due_date:'01/01/2027',balance:'5 €'},brand:{...settings.brand,logo},template:settings.templates.invoice_due.es}
    const preview=renderCustomerBillingEmail({...shared,preview:true})
    const sent=renderCustomerBillingEmail(shared)
    const bold=renderCustomerBillingEmail({...shared,brand:{...shared.brand,layout:'bold'}})
    expect(preview.html).toContain(`src="${logo}"`)
    expect(preview.html.match(/<img /g)).toHaveLength(1)
    expect(preview.html).toContain('max-width:72px;max-height:48px;height:auto;object-fit:contain')
    expect(preview.html.indexOf(`src="${logo}"`)).toBeLessThan(preview.html.indexOf('Este mensaje te lo envía'))
    expect(preview.html).not.toContain('margin-bottom:18px')
    expect(preview.attachments).toEqual([])
    expect(sent.html).toContain('src="cid:company-email-logo"')
    expect(sent.attachments).toHaveLength(1)
    expect(preview.html).not.toBe(bold.html)
    expect(bold.html).toContain('background:#334155')
    expect(bold.html).toContain('background:#ffffff;border-radius:9px')
    expect(bold.html).toContain('Tu propuesta está lista')
  })

  it('chooses accessible sender text for light accent colors',()=>{
    const settings=defaultCustomerEmailSettings()
    const message=renderCustomerBillingEmail({kind:'invoice_due',companyName:'Company',data:{invoice_number:'F-1',due_date:'01/01/2027',balance:'5 €'},brand:{...settings.brand,palette:{...settings.brand.palette,accent:'#f8fafc'}},template:settings.templates.invoice_due.es})
    expect(message.html).toContain('background-color:#f8fafc')
    expect(message.html).toContain('color:#000000;font:700 14px/1.4 Arial,Helvetica,sans-serif')
  })
})
