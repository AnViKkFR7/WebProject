// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import CreateUserTab from './CreateUserTab'
const service=vi.hoisted(()=>({inviteUser:vi.fn(),createUserWithPassword:vi.fn()}))
vi.mock('../../services/userService',()=>({userService:service}))
vi.mock('../../contexts/LanguageContext',()=>({useLanguage:()=>({t:key=>key})}))
vi.mock('../../contexts/FeedbackContext',()=>({useFeedback:()=>({toast:{success:vi.fn(),error:vi.fn()}})}))
let host,root
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<CreateUserTab companies={[{id:'company-a',name:'Company A'}]}/>))
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();vi.unstubAllGlobals()})
const change=async(input,value)=>act(async()=>{
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value)
 input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))
})
async function fill(){
 await change(host.querySelector('input[type=email]'),'person@example.test')
 await change(host.querySelector('input[type=text]'),'Person')
 await act(async()=>host.querySelector('input[placeholder="profile.createUser.companySearchPlaceholder"]').dispatchEvent(new FocusEvent('focusin',{bubbles:true})))
 await act(async()=>[...host.querySelectorAll('div')].filter(el=>el.textContent==='Company A').at(-1).click())
 await act(async()=>[...host.querySelectorAll('input[type=radio]')].find(el=>el.value!=='password').click())
}
const submit=async()=>act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
it('preserves partial invitation input and retries only after an explicit click',async()=>{
 service.inviteUser.mockResolvedValueOnce({success:false,membership:true,account:'exists',delivery:'unknown'}).mockResolvedValueOnce({success:true,membership:true,delivery:'accepted'})
 await fill();await submit()
 expect(host.querySelector('input[type=email]').value).toBe('person@example.test')
 expect(host.textContent).toContain('profile.messages.invitationDeliveryPending')
 expect(host.textContent).not.toContain('profile.messages.userInvited')
 expect(service.inviteUser.mock.calls[0][0].resend).toBe(false)
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='profile.messages.retryInvitation').click())
 expect(service.inviteUser.mock.calls[1][0]).toMatchObject({company_id:'company-a',email:'person@example.test',resend:true})
 expect(host.textContent).toContain('profile.messages.userInvited')
  expect(host.querySelector('input[type=email]').value).toBe('person@example.test')
  expect(host.textContent).toContain('profile.messages.resendInvitation')
})
it('does not offer the old retry when its email or company context changes',async()=>{
 service.inviteUser.mockResolvedValue({success:false,membership:false,account:'pending',delivery:'failed'})
 await fill();await submit()
 expect(host.textContent).toContain('profile.messages.retryInvitation')
 await change(host.querySelector('input[type=email]'),'other@example.test')
 expect(host.textContent).not.toContain('profile.messages.retryInvitation')
})
it('preserves input on transport failure and distinguishes an existing confirmed account',async()=>{
 service.inviteUser.mockRejectedValueOnce(new Error('invitation_busy')).mockResolvedValueOnce({success:true,membership:true,delivery:'not_required'})
 await fill();await submit()
 expect(host.textContent).toContain('profile.messages.invitationCooldown')
 expect(host.querySelector('input[type=email]').value).toBe('person@example.test')
 await submit()
 expect(host.textContent).toContain('profile.messages.userLinked')
 expect(host.textContent).not.toContain('profile.messages.userInvited')
})
it('preserves password input on partial creation and never displays it as an existing account credential',async()=>{
 await fill()
 await act(async()=>host.querySelector('input[type=radio][value=password]').click())
 await change(host.querySelector('input[type=password]'),'StrongPass123!')
 service.createUserWithPassword.mockResolvedValueOnce({success:false,membership:false}).mockResolvedValueOnce({success:true,membership:true,password_created:false})
 await submit()
 expect(host.querySelector('input[type=password]').value).toBe('StrongPass123!')
 expect(host.textContent).toContain('profile.messages.invitationPending')
 await submit()
 expect(host.textContent).toContain('profile.messages.userRecovered')
 expect(host.querySelector('input[type=password]').value).toBe('')
 expect(host.textContent).not.toContain('StrongPass123!')
})
