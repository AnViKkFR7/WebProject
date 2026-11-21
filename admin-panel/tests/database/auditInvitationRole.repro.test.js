import {afterAll,expect,it} from 'vitest'
import {fullApplication} from './fullApplication'
import {ids} from './helpers'
let db
// Regression: the latest authorized role applies before a membership exists.
it('uses viewer on a corrected retry before membership exists',async()=>{
 db=await fullApplication()
 const claim=async(role,resend)=>(await db.query("select public.claim_company_user_invitation($1,$2,'audit@example.test','Audit',$3,$4) j",[ids.admin,ids.a,role,resend])).rows[0].j
 const first=await claim('editor',false)
 await db.query("select public.finish_company_user_invitation($1,$2,'failed')",[first.id,first.token])
 await db.exec("update public.company_user_invitations set last_attempt_at=now()-interval '61 seconds'")
 const second=await claim('viewer',true)
 const user=crypto.randomUUID()
 await db.query("insert into auth.users(id,email) values($1,'audit@example.test')",[user])
 const attached=(await db.query('select public.attach_company_user_invitation($1,$2,$3) r',[second.id,second.token,user])).rows[0].r
 expect(attached.role).toBe('viewer')
 expect(attached.ready).toBe(true)
},60000)
afterAll(async()=>db?.close())
