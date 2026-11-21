import {beforeEach,expect,it,vi} from 'vitest'
import {userService} from './userService'
const mocks=vi.hoisted(()=>({invoke:vi.fn(),session:vi.fn()}))
vi.mock('../lib/supabaseClient',()=>({supabase:{auth:{getSession:mocks.session},functions:{invoke:mocks.invoke}}}))
vi.mock('../lib/operationalTelemetry',()=>({reportOperationalFailure:vi.fn()}))
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({data:{session:{access_token:'test'}}})})
it('preserves partial invitation state and passes explicit resend intent to the server',async()=>{
 const partial={success:false,membership:true,account:'exists',delivery:'unknown'}
 mocks.invoke.mockResolvedValue({data:partial,error:null})
 const payload={email:'person@example.test',full_name:'Person',company_id:'company-a',role:'viewer'}
 expect(await userService.inviteUser(payload)).toEqual(partial)
 expect(mocks.invoke).toHaveBeenLastCalledWith('invite-user',{body:{...payload,resend:false}})
 await userService.inviteUser({...payload,resend:true})
 expect(mocks.invoke).toHaveBeenLastCalledWith('invite-user',{body:{...payload,resend:true}})
})
it('returns the complete administrative list and rejects server errors without returning partial data',async()=>{
 const users=Array.from({length:101},(_,i)=>({id:String(i)}))
 mocks.invoke.mockResolvedValueOnce({data:{users},error:null}).mockResolvedValueOnce({data:{users:[{id:'partial'}]},error:new Error('page failed')})
 expect(await userService.getAllUsers()).toHaveLength(101)
 await expect(userService.getAllUsers()).rejects.toThrow('Error al obtener lista de usuarios')
})
it('does not invoke administrative functions without a session',async()=>{
 mocks.session.mockResolvedValue({data:{session:null}})
 await expect(userService.getAllUsers()).rejects.toThrow('No hay sesión activa')
 await expect(userService.inviteUser({})).rejects.toThrow('No hay sesión activa')
 expect(mocks.invoke).not.toHaveBeenCalled()
})
