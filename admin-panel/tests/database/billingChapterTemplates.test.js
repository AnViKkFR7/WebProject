import {afterAll,beforeAll,expect,it} from 'vitest'
import {database,document,ids,login,save,sqlFile} from './helpers'
let db
const lines=[{id:'line-a',chapter:'01 · Preparación',description:'Protección',quantity:1,price:50,discount:0,tax:21},{id:'line-b',chapter:'02 · Ejecución',description:'Trabajo',quantity:2,price:100,discount:5,tax:21}]
beforeAll(async()=>{db=await database();for(const file of ['BILLING_SECURITY_HARDENING.sql','BILLING_DOCUMENT_PRESENTATION.sql','BILLING_APPEARANCE.sql','BILLING_DIRECTORY_CATALOG.sql','BILLING_CHAPTER_TEMPLATES.sql'])await db.exec(await sqlFile('migrations/'+file));await login(db)},30000)
afterAll(async()=>db?.close())
it('stores a company template and documents retain copied chapters after archive',async()=>{
  const template=(await db.query('select * from public.save_billing_chapter_template($1,$2,$3::jsonb)',[ids.a,'Reforma',JSON.stringify(lines)])).rows[0]
  expect(template).toMatchObject({company_id:ids.a,name:'Reforma',lines})
  const doc=document();doc.lines=template.lines;const quote=await save(db,ids.a,doc,'draft','quote')
  await db.query('select public.archive_billing_chapter_template($1,$2)',[ids.a,template.id])
  expect((await db.query('select document from public.quotes where id=$1',[quote.id])).rows[0].document.lines).toEqual(lines)
})
it('validates templates and denies viewer, cross-company and direct writes',async()=>{
  await expect(db.query("select public.save_billing_chapter_template($1,'Vacía','[]'::jsonb)",[ids.a])).rejects.toThrow('Invalid chapter template')
  const cross=(await db.query('select * from public.save_billing_chapter_template($1,$2,$3::jsonb)',[ids.a,'Solo A',JSON.stringify(lines)])).rows[0]
  await login(db,'viewer');await expect(db.query('select public.save_billing_chapter_template($1,$2,$3::jsonb)',[ids.a,'Viewer',JSON.stringify(lines)])).rejects.toThrow('Forbidden')
  await login(db,'editorB');await expect(db.query('select public.archive_billing_chapter_template($1,$2)',[ids.b,cross.id])).rejects.toThrow('Template changed or unavailable')
  await login(db);await expect(db.query("insert into public.billing_chapter_templates(company_id,name,lines,created_by,updated_by) values($1,'Bypass','[]',$2,$2)",[ids.a,ids.editor])).rejects.toThrow('permission denied')
})
