import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {DocumentDraftSession} from './documentDraftSession'
import {draftFingerprint,readDraftRecovery,writeDraftRecovery,clearDraftRecovery} from './documentDrafts'
import {document} from '../../tests/database/helpers'
const scope={userId:'user-a',companyId:'company-a',kind:'invoice',key:'new'}
const storage=()=>{const values=new Map();return {get length(){return values.size},key:index=>[...values.keys()][index],getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}}
let cache,sessions
const create=(options={})=>{
  let version=0
  const service={load:vi.fn().mockResolvedValue(null),save:vi.fn(async(_scope,doc,baseVersion,_version,write)=>({id:'id',version:++version,document:doc,base_version:baseVersion,last_write:write})),remove:vi.fn().mockResolvedValue(),...options.service}
  const session=new DocumentDraftSession({scope,document:document(),baseVersion:null,onChange:vi.fn(),onRecover:vi.fn(),storage:cache,...options,service})
  sessions.push(session);return session
}
beforeEach(()=>{vi.useFakeTimers();cache=storage();sessions=[]})
afterEach(()=>{sessions.forEach(session=>session.destroy());vi.useRealTimers()})
it('debounces incomplete edits for one second, serializes writes and never replaces newer input',async()=>{
  const session=create();await session.initialize()
  const first={...document(),customer:{name:'Incomplete'}},second={...first,notes:'Latest'}
  session.update(first)
  await vi.advanceTimersByTimeAsync(999)
  expect(session.service.save).not.toHaveBeenCalled()
  let finish
  session.service.save.mockImplementationOnce((_scope,doc)=>new Promise(resolve=>{finish=()=>resolve({id:'id',version:1,document:doc})}))
  await vi.advanceTimersByTimeAsync(1)
  session.update(second);await vi.advanceTimersByTimeAsync(1000)
  expect(session.service.save).toHaveBeenCalledTimes(1)
  finish();await vi.advanceTimersByTimeAsync(0)
  expect(session.service.save).toHaveBeenCalledTimes(2)
  expect(session.service.save.mock.calls[1][3]).toBe(1)
  expect(session.current.notes).toBe('Latest')
  expect(session.ack).toBe(draftFingerprint(second))
})
it('keeps a stable write token for a failed request, preserves input and stops on a CAS conflict',async()=>{
  const session=create();await session.initialize();session.update({...document(),notes:'Keep me'})
  session.service.save.mockRejectedValueOnce(new Error('offline'))
  await vi.advanceTimersByTimeAsync(1000)
  const token=session.service.save.mock.calls[0][4]
  expect(readDraftRecovery(scope,cache).document.notes).toBe('Keep me')
  await session.saveNow()
  expect(session.service.save.mock.calls[1][4]).toBe(token)
  session.update({...document(),notes:'Conflict'})
  session.service.save.mockRejectedValueOnce({code:'40001'})
  await vi.advanceTimersByTimeAsync(1000)
  expect(session.status).toBe('conflict')
  const calls=session.service.save.mock.calls.length
  session.update({...document(),notes:'Still local'});await vi.advanceTimersByTimeAsync(5000)
  expect(session.service.save).toHaveBeenCalledTimes(calls)
  expect(session.current.notes).toBe('Still local')
})
it('offers recovery explicitly without overwriting the local candidate during unmount',async()=>{
  const local={...document(),notes:'Local unsent'}
  writeDraftRecovery(scope,{document:local,baseVersion:null},cache)
  const session=create({service:{load:vi.fn().mockResolvedValue({id:'remote',version:2,base_version:null,document:{...document(),notes:'Remote'}})}})
  await session.initialize()
  expect(session.onRecover).not.toHaveBeenCalled()
  session.destroy()
  expect(readDraftRecovery(scope,cache).document.notes).toBe('Local unsent')
})
it('recovers a copy, prepares a manual save in order, and clears recovery only after success',async()=>{
  const recovered={...document(),notes:'Recovered'}
  const session=create({service:{load:vi.fn().mockResolvedValue({id:'id',version:1,base_version:null,document:recovered})}})
  await session.initialize();session.recover('remote')
  expect(session.onRecover).toHaveBeenCalledWith(recovered)
  expect(session.status).toBe('saved')
  expect(await session.prepare(recovered)).toMatchObject({id:'id',version:1,key:'new'})
  expect(readDraftRecovery(scope,cache)).not.toBeNull()
  session.complete();session.destroy()
  expect(readDraftRecovery(scope,cache)).toBeNull()
})
it('ignores a stale load after destruction and does not queue additional writes for a previous workspace',async()=>{
  let finish
  const session=create({service:{load:vi.fn(()=>new Promise(resolve=>{finish=resolve}))}})
  const loading=session.initialize();session.destroy();finish({id:'foreign',version:1,document:document()});await loading
  expect(session.onChange).toHaveBeenCalledTimes(1)
  session.update({...document(),notes:'Old scope'});await vi.advanceTimersByTimeAsync(2000)
  expect(session.service.save).not.toHaveBeenCalled()
})
it('expires local copies, isolates every scope dimension and clears only the recovery namespace on logout',()=>{
  writeDraftRecovery(scope,{document:document(),baseVersion:null},cache,100)
  for(const change of [{userId:'other'},{companyId:'other'},{kind:'quote'},{key:'other'}])expect(readDraftRecovery({...scope,...change},cache,101)).toBeNull()
  expect(readDraftRecovery(scope,cache,100+24*60*60*1000)).toBeNull()
  writeDraftRecovery(scope,{document:document(),baseVersion:null},cache)
  cache.setItem('unrelated','keep');clearDraftRecovery(cache)
  expect(cache.length).toBe(1);expect(cache.getItem('unrelated')).toBe('keep')
})
it('still backs up typing when the initial remote load fails',async()=>{
  const session=create({service:{load:vi.fn().mockRejectedValue(new Error('network'))}})
  await session.initialize();session.update({...document(),notes:'Offline typing'})
  await vi.advanceTimersByTimeAsync(1000)
  expect(readDraftRecovery(scope,cache).document.notes).toBe('Offline typing')
  expect(session.service.save).not.toHaveBeenCalled()
})
it('prevents a consumed recovery copy from becoming a duplicate document after reloading',async()=>{
  writeDraftRecovery(scope,{document:document(),baseVersion:null,draftId:'completed-id'},cache)
  const session=create({service:{load:vi.fn().mockResolvedValue({completed_record:{id:'existing',document:document()}})}})
  await session.initialize();session.recover('local')
  expect(session.onRecover).not.toHaveBeenCalled()
  expect(session.candidates.local.completed).toBe(true)
  expect(session.service.load).toHaveBeenCalledWith(scope,'completed-id')
})
it('keeps explicit saving available if the new backend migration has not been installed',async()=>{
  const session=create({service:{load:vi.fn().mockRejectedValue({code:'PGRST202'})}})
  await session.initialize()
  expect(session.status).toBe('unavailable')
  expect(await session.prepare(document())).toBeUndefined()
})
