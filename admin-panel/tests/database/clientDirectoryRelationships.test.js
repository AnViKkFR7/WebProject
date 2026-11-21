import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { fullApplication } from './fullApplication'
import { document, ids, login } from './helpers'

// Clientes y colaboradores: tipo de relación y forma jurídica, con permisos de servidor y
// aislamiento entre empresas para la ficha y su resumen.
let db
const party = (overrides = {}) => ({
  name: 'Lucía Pérez', tax_id: '12345678-Z', legal_form: 'individual', is_client: false, is_collaborator: true,
  collaborator_role: 'Fotógrafa', responsible: 'No aplica', email: 'lucia@example.test', ...overrides,
})
const saveParty = async (company, data, id = null) =>
  (await db.query('select * from public.save_directory_party($1,$2,$3::jsonb)', [company, id, JSON.stringify(data)])).rows[0]
const summary = async (company, id) =>
  (await db.query('select public.get_directory_party_summary($1,$2) as s', [company, id])).rows[0].s
const setModule = async (key, enabled) => {
  await db.exec('reset role')
  await db.query('update public.company_modules set is_enabled=$1 where company_id=$2 and module_key=$3', [enabled, ids.a, key])
}

beforeAll(async () => { db = await fullApplication() }, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec("reset role; update public.company_modules set is_enabled=true where module_key in ('planning','billing','crm')")
})

it('las fichas existentes quedan como cliente y empresa', async () => {
  await login(db, 'editor')
  const legacy = (await db.query("select * from public.save_client_company($1,null,'Antigua SL','B1','','','','Ana','#1976d2')", [ids.a])).rows[0]
  expect(legacy).toMatchObject({ legal_form: 'company', is_client: true, is_collaborator: false })
})

it('guarda colaboradores persona física sin persona de contacto y con especialidad', async () => {
  await login(db, 'editor')
  const created = await saveParty(ids.a, party())
  expect(created).toMatchObject({
    company_id: ids.a, legal_form: 'individual', is_client: false, is_collaborator: true,
    collaborator_role: 'Fotógrafa', responsible: null, updated_by: ids.editor,
  })
  // Pasa a ser también cliente y empresa: conserva la persona de contacto.
  const updated = await saveParty(ids.a, party({ legal_form: 'company', is_client: true, responsible: 'Ana' }), created.id)
  expect(updated).toMatchObject({ legal_form: 'company', is_client: true, is_collaborator: true, responsible: 'Ana' })
  // Deja de ser colaborador: la especialidad se limpia.
  const clientOnly = await saveParty(ids.a, party({ legal_form: 'company', is_client: true, is_collaborator: false }), created.id)
  expect(clientOnly.collaborator_role).toBeNull()
})

it('rechaza datos inválidos', async () => {
  await login(db, 'editor')
  for (const bad of [
    party({ is_client: false, is_collaborator: false }),
    party({ legal_form: 'sociedad' }),
    party({ is_client: 'yes' }),
    party({ name: ' ' }),
    party({ notes: 'x'.repeat(4001) }),
    party({ color: 'red' }),
  ]) await expect(saveParty(ids.a, bad)).rejects.toThrow('Invalid directory data')
  await expect(db.query("select public.save_directory_party($1,null,'[]'::jsonb)", [ids.a])).rejects.toThrow('Invalid directory data')
  await db.exec('reset role')
  await expect(db.query("insert into public.client_company(company_id,name,is_client,is_collaborator) values($1,'X',false,false)", [ids.a])).rejects.toThrow(/relationship_check/)
})

it('deniega escribir a lectores, a otras empresas, a anónimos y sin módulos', async () => {
  await login(db, 'editor')
  const own = await saveParty(ids.a, party())
  await login(db, 'viewer')
  await expect(saveParty(ids.a, party())).rejects.toThrow('Forbidden')
  await login(db, 'editorB')
  await expect(saveParty(ids.a, party())).rejects.toThrow('Forbidden')
  // Con su propia empresa tampoco puede tocar una ficha de A.
  await expect(saveParty(ids.b, party({ name: 'Robada' }), own.id)).rejects.toThrow('Client changed or unavailable')
  await login(db, null, 'anon')
  await expect(saveParty(ids.a, party())).rejects.toThrow(/permission denied/)
  await setModule('planning', false); await setModule('billing', false)
  await login(db, 'editor')
  await expect(saveParty(ids.a, party())).rejects.toThrow('Company module is disabled')
})

it('resume facturas, presupuestos, agenda y movimientos de la ficha, y nada de otras empresas', async () => {
  await login(db, 'editor')
  const client = await saveParty(ids.a, { name: 'Cliente Uno SL', tax_id: 'B-456', legal_form: 'company', is_client: true })
  const doc = document()
  let n = 0
  const insertDoc = (company, status, taxId, kind = 'invoices') => db.query(
    `insert into public.${kind}(company_id,number,status,document,created_by,last_edited_by) values($1,$2,$3,$4::jsonb,$5,$5)`,
    [company, `T-${++n}`, status, JSON.stringify({ ...doc, customer: { ...doc.customer, taxId } }), company === ids.a ? ids.editor : ids.editorB],
  )
  await db.exec('reset role')
  await insertDoc(ids.a, 'issued', 'b456')
  await insertDoc(ids.a, 'paid', 'B 456')
  await insertDoc(ids.a, 'issued', 'OTRO')
  await insertDoc(ids.a, 'draft', 'B456')
  await insertDoc(ids.a, 'sent', 'B456', 'quotes')
  await insertDoc(ids.a, 'draft', 'B456', 'quotes')
  // La empresa B tiene una factura con el mismo NIF: no debe contar.
  await insertDoc(ids.b, 'issued', 'B456')
  await db.query("insert into public.planning_task(company_id,client_company_id,title,start_datetime) values($1,$2,'Visita',now()+interval '2 days'),($1,$2,'Pasada',now()-interval '2 days')", [ids.a, client.id])
  await db.query("insert into public.billing(company_id,client_company_id,title,billing_date,amount,direction) values($1,$2,'Cobro',current_date,50,'cobrar'),($1,$2,'Pago',current_date,20,'pagar')", [ids.a, client.id])

  await login(db, 'viewer')
  const result = await summary(ids.a, client.id)
  expect(result.matched_by).toBe('tax_id')
  expect(result.invoices).toMatchObject({ count: 2, total: 242, paid: 121, outstanding: 121 })
  expect(result.invoices.monthly.length).toBeLessThanOrEqual(12)
  expect(result.quotes).toMatchObject({ count: 1, open: 1, accepted: 0 })
  expect(result.planning).toMatchObject({ count: 2, upcoming: 1 })
  expect(result.planning.next.title).toBe('Visita')
  expect(result.movements).toMatchObject({ count: 2, to_collect: 50, to_pay: 20 })

  // Sin facturación solo queda la agenda.
  await setModule('billing', false)
  await login(db, 'viewer')
  const planningOnly = await summary(ids.a, client.id)
  expect(planningOnly.invoices).toBeNull()
  expect(planningOnly.planning.count).toBe(2)
})

it('deniega el resumen a otras empresas, a anónimos, a miembros suspendidos y con la ficha de otra empresa', async () => {
  await login(db, 'editor')
  const own = await saveParty(ids.a, party())
  await login(db, 'editorB')
  await expect(summary(ids.a, own.id)).rejects.toThrow('Forbidden')
  await expect(summary(ids.b, own.id)).rejects.toThrow('Client not found')
  await login(db, null, 'anon')
  await expect(summary(ids.a, own.id)).rejects.toThrow(/permission denied/)
  await db.exec('reset role')
  await db.query('update public.company_members set is_active=false where user_id=$1', [ids.viewer])
  await login(db, 'viewer')
  await expect(summary(ids.a, own.id)).rejects.toThrow('Forbidden')
  await db.exec('reset role')
  await db.query('update public.company_members set is_active=true where user_id=$1', [ids.viewer])
})
