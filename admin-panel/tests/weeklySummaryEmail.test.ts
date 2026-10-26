import {describe,expect,it} from 'vitest'
import {buildWeeklySummaryEmail,splitWeeklySummaryRecipients} from '../../supabase/functions/_shared/weeklySummary'

const payload={
  week_start:'2026-10-19',week_end:'2026-10-25',recipient_emails:['owner@example.test'],
  new_leads:3,new_contacts:2,overdue_followups:1,issued_invoices:4,overdue_invoices:1,
  quotes_waiting:5,upcoming_planning:6,page_views:120,
}

describe('weekly summary email',()=>{
  it('contains only aggregate counts and identifies the automatic admin email',()=>{
    const message=buildWeeklySummaryEmail(payload)
    expect(message.subject).toContain('Resumen semanal')
    expect(message.text).toContain('Solicitudes recibidas: 3')
    expect(message.text).toContain('administradores activos')
    expect(message.html).not.toContain('Ajustes')
    expect(message.html).not.toContain('owner@example.test')
    expect(message.html).not.toContain('Cliente')
    expect(message.html).not.toContain('Factura F-')
  })

  it('normalizes invalid counts and rejects malformed date ranges',()=>{
    const message=buildWeeklySummaryEmail({...payload,new_leads:-2,page_views:Infinity})
    expect(message.text).toContain('Solicitudes recibidas: 0')
    expect(message.text).toContain('Páginas vistas: 0')
    expect(()=>buildWeeklySummaryEmail({...payload,week_start:'not-a-date'})).toThrow('Invalid week range')
    expect(()=>buildWeeklySummaryEmail({...payload,week_start:'2026-02-31'})).toThrow('Invalid week range')
  })

  it('validates and hides the administrator recipient list using BCC',()=>{
    expect(splitWeeklySummaryRecipients(['one@example.test','TWO@example.test','one@example.test','invalid'])).toEqual({to:'one@example.test',bcc:['TWO@example.test']})
    expect(splitWeeklySummaryRecipients([])).toEqual({to:null,bcc:[]})
  })
})
