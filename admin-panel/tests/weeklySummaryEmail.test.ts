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

  it('renders the MoiraOrdo editorial layout and keeps the panel link safe',()=>{
    const message=buildWeeklySummaryEmail(payload,{adminAppUrl:'https://admin.example.test/settings?token=private'})
    expect(message.html).toContain('<html lang="es">')
    expect(message.html).toContain('max-width:640px')
    expect(message.html).toContain('Tu semana,<br>en perspectiva')
    expect(message.html).toContain('01 / Tu foco ahora')
    expect(message.html).toContain('02 / La actividad de la semana')
    expect(message.html).toContain('03 / Mira hacia delante')
    expect(message.html).toContain('href="https://admin.example.test/"')
    expect(message.html).not.toContain('token=private')
    expect(message.html).toContain('https://www.moiraordo.es')
    expect(message.html).not.toContain('<img')
    expect(buildWeeklySummaryEmail(payload,{adminAppUrl:'javascript:alert(1)'}).html).toContain('href="https://admin.moiraordo.es/"')
    expect(buildWeeklySummaryEmail(payload,{adminAppUrl:'https://user:password@example.test/'}).html).not.toContain('user:password')
  })

  it('supports a quiet week and clearly labels the one-shot delivery test',()=>{
    const quiet=buildWeeklySummaryEmail({...payload,overdue_followups:0,overdue_invoices:0,quotes_waiting:0,upcoming_planning:1},{isTest:true})
    expect(quiet.html).toContain('Sin pendientes en este resumen')
    expect(quiet.html).toContain('1 tarea en el horizonte')
    expect(quiet.subject).toMatch(/^\[PRUEBA\]/)
    expect(quiet.html).toContain('PRUEBA DE ENTREGA · WatchEcommerceDemo')
    expect(quiet.text).toContain('envío manual de prueba')
  })

  it('validates and hides the administrator recipient list using BCC',()=>{
    expect(splitWeeklySummaryRecipients(['one@example.test','TWO@example.test','one@example.test','invalid'])).toEqual({to:'one@example.test',bcc:['TWO@example.test']})
    expect(splitWeeklySummaryRecipients([])).toEqual({to:null,bcc:[]})
  })
})

it('explains the historical issuance scope and recurring occurrence counts',()=>{
  const email=buildWeeklySummaryEmail(payload)
  for(const content of [email.text,email.html]){
    expect(content).toContain('sin fecha de emisión verificable')
    expect(content).toContain('Cada repetición de una tarea recurrente')
  }
})
