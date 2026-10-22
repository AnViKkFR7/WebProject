import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { database, document, ids, login, profile, save } from './helpers'
let db
beforeAll(async () => { db = await database() },30000)
afterAll(async () => { await db?.close() })
describe('original migrations — reproduce audit findings', () => {
  it('denies direct access to another tenant and denies viewer writes', async () => {
    await login(db,'editor')
    await expect(save(db,ids.b)).rejects.toThrow('Forbidden')
    await login(db,'viewer')
    await expect(save(db)).rejects.toThrow('Forbidden')
  })
  it('accepts a relative date that changes meaning over time', async () => {
    await login(db)
    const doc = document(); doc.date = 'today'
    expect((await save(db,ids.a,doc)).document.date).toBe('today')
  })
  it('accepts non-string party names that break form editing', async () => {
    const doc = document(); doc.customer.name = { malicious:'object' }
    expect((await save(db,ids.a,doc)).document.customer.name).toEqual({ malicious:'object' })
  })
  it('accepts a non-finite price sent as a string', async () => {
    const doc = document(); doc.lines[0].price = 'NaN'
    expect((await save(db,ids.a,doc)).document.lines[0].price).toBe('NaN')
  })
  it('accepts a remote tracking logo through a direct RPC', async () => {
    await db.query('select public.save_invoice_profile($1,$2::jsonb)',[ids.a,JSON.stringify({ ...profile,logo:'https://example.invalid/tracker.svg' })])
    expect((await db.query('select profile from public.invoice_settings where company_id=$1',[ids.a])).rows[0].profile.logo).toContain('https:')
  })
  it('accepts a foreign tenant client reference in the original planning schema', async () => {
    await db.exec('reset role')
    const client='30000000-0000-4000-8000-000000000099'
    await db.query('insert into public.client_company(id,company_id,name) values ($1,$2,$3)',[client,ids.b,'Foreign client'])
    await login(db,'editor')
    const result=await db.query('insert into public.planning_task(company_id,client_company_id) values ($1,$2) returning client_company_id',[ids.a,client])
    expect(result.rows[0].client_company_id).toBe(client)
  })

})
