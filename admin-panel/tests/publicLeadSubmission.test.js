// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
beforeEach(()=>{vi.resetModules();vi.stubEnv('VITE_COMPANY_ID','123e4567-e89b-42d3-a456-426614174000')})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('reports rate limiting without emitting a successful conversion or altering form input',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('Too many requests',{status:429})))
  const sent=vi.fn();window.addEventListener('moira:lead-sent',sent)
  try{
    const input={name:'Ada',email:'ada@example.test',message:'Keep this message'}
    const {submitLead}=await import('../../company-site-snippet/lib/leads')
    expect(await submitLead(input)).toEqual({ok:false,reason:'rate_limited'})
    expect(sent).not.toHaveBeenCalled();expect(input.message).toBe('Keep this message')
  }finally{window.removeEventListener('moira:lead-sent',sent)}
})
it('retains successful submission and conversion for accepted leads',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('OK',{status:201})))
  const sent=vi.fn();window.addEventListener('moira:lead-sent',sent)
  try{
    const {submitLead}=await import('../../company-site-snippet/lib/leads')
    expect(await submitLead({name:'Ada',phone:'123'})).toEqual({ok:true})
    expect(sent).toHaveBeenCalledTimes(1)
  }finally{window.removeEventListener('moira:lead-sent',sent)}
})
