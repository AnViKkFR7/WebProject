import {afterAll,beforeAll,describe,expect,it} from 'vitest'
import {database,ids,login,sqlFile} from './helpers'

let db
const companyAdminId='20000000-0000-4000-8000-000000000007'
const loginCompanyAdmin=async()=>{
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)",[companyAdminId])
  await db.exec('set role authenticated')
}
const settings={
  brand:{layout:'classic',logo:'',emailLanguage:'es',palette:{id:'graphite',accent:'#334155',ink:'#20252b',muted:'#58616d',paper:'#ffffff',surface:'#f1f3f5'}},
  templates:Object.fromEntries(['quote_approval','invoice_due'].map(kind=>[kind,Object.fromEntries(['es','en'].map(locale=>[locale,{subject:'Subject {{company_name}}',preheader:'From {{company_name}}',html:'<p>Hello {{customer_name}}</p>'}]))])),
}

beforeAll(async()=>{
  db=await database()
  await db.exec('create role service_role; alter table public.companies add column name text not null default \'Company\'')
  await db.query('insert into auth.users(id) values($1)',[companyAdminId])
  await db.query('insert into public.company_members(company_id,user_id,role) values($1,$2,\'admin\')',[ids.a,companyAdminId])
  await db.exec(await sqlFile('migrations/BILLING_SECURITY_HARDENING.sql'))
  await db.exec(await sqlFile('migrations/BILLING_DOCUMENT_PRESENTATION.sql'))
  await db.exec(await sqlFile('migrations/BILLING_APPEARANCE.sql'))
  await db.exec(await sqlFile('migrations/COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql'))
},30000)
afterAll(async()=>{await db?.close()})

describe('company customer email settings migration',()=>{
  it('keeps settings private and limits RPC read/write to the company or platform admin',async()=>{
    await login(db)
    await expect(db.query('select * from public.company_customer_email_settings')).rejects.toThrow('permission denied')
    await expect(db.query('select * from public.company_customer_email_revisions')).rejects.toThrow('permission denied')
    await expect(db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.a,JSON.stringify(settings)])).rejects.toThrow('Forbidden')
    await expect(db.query('select * from public.get_company_customer_email_revisions($1)',[ids.a])).rejects.toThrow('Forbidden')
    await login(db,'editorB')
    await expect(db.query('select public.get_company_customer_email_settings($1)',[ids.a])).rejects.toThrow('Forbidden')
    await expect(db.query('select public.restore_company_customer_email_revision($1,$2)',[ids.a,'00000000-0000-4000-8000-000000000000'])).rejects.toThrow('Forbidden')
    await login(db,'admin')
    await db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.a,JSON.stringify(settings)])
    expect((await db.query('select public.get_company_customer_email_settings($1) as settings',[ids.a])).rows[0].settings).toEqual(settings)
  })

  it('allows a company administrator but denies access outside that company',async()=>{
    await loginCompanyAdmin()
    await db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.a,JSON.stringify(settings)])
    expect((await db.query('select public.get_company_customer_email_settings($1) as settings',[ids.a])).rows[0].settings).toEqual(settings)
    await expect(db.query('select public.get_company_customer_email_settings($1)',[ids.b])).rejects.toThrow('Forbidden')
    await expect(db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.b,JSON.stringify(settings)])).rejects.toThrow('Forbidden')
  })

  it('persists the selected customer email language in the existing settings JSON',async()=>{
    await login(db,'admin')
    const english={...settings,brand:{...settings.brand,emailLanguage:'en'}}
    await db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.a,JSON.stringify(english)])
    const saved=(await db.query('select public.get_company_customer_email_settings($1) as settings',[ids.a])).rows[0].settings
    expect(saved.brand.emailLanguage).toBe('en')
  })

  it('keeps a bounded company history and restores a revision as a new change',async()=>{
    await login(db,'admin')
    await db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.b,JSON.stringify(settings)])
    const changed={...settings,brand:{...settings.brand,layout:'bold'}}
    await db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.b,JSON.stringify(changed)])
    const history=(await db.query('select revision_id,created_by,settings from public.get_company_customer_email_revisions($1)',[ids.b])).rows
    expect(history.length).toBe(2)
    const previous=history.find(revision=>revision.settings.brand.layout==='classic')
    expect(previous.settings).toEqual(settings)
    expect(previous.created_by).toBe(ids.admin)
    await db.query('select public.restore_company_customer_email_revision($1,$2)',[ids.b,previous.revision_id])
    expect((await db.query('select public.get_company_customer_email_settings($1) as settings',[ids.b])).rows[0].settings).toEqual(settings)
    expect((await db.query('select * from public.get_company_customer_email_revisions($1)',[ids.b])).rows).toHaveLength(3)
  })

  it('prunes revisions beyond the per-company history limit',async()=>{
    await login(db,'admin')
    for(let index=0;index<12;index++){
      const version={...settings,templates:{...settings.templates,invoice_due:{...settings.templates.invoice_due,es:{...settings.templates.invoice_due.es,subject:`Subject ${index}`}}}}
      await db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.a,JSON.stringify(version)])
    }
    expect((await db.query('select * from public.get_company_customer_email_revisions($1)',[ids.a])).rows).toHaveLength(10)
  })

  it('reports every required object and grant in the read-only preflight',async()=>{
    const result=(await db.query(await sqlFile('maintenance/COMPANY_CUSTOMER_EMAIL_TEMPLATES_PREFLIGHT.sql'))).rows[0]
    expect(Object.values(result)).toEqual(Array(Object.keys(result).length).fill(true))
  })

  it('rejects invalid palette contrast and spoofed logo image signatures',async()=>{
    await login(db,'admin')
    const weak={...settings,brand:{...settings.brand,palette:{...settings.brand.palette,accent:'#ffffff'}}}
    await expect(db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.a,JSON.stringify(weak)])).rejects.toThrow('contrast')
    const spoofed={...settings,brand:{...settings.brand,logo:'data:image/png;base64,PHN2Zy8+'}}
    await expect(db.query('select public.save_company_customer_email_settings($1,$2::jsonb)',[ids.a,JSON.stringify(spoofed)])).rejects.toThrow('logo')
  })
})
