// @vitest-environment happy-dom
import {act,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({import:vi.fn()}))
vi.mock('../components/myData/excelUtils',()=>({importExcel:(...args)=>mocks.import(...args)}))
import {useDefinitionDraft} from './useDefinitionDraft'
let root,node,draft
function Harness({scope}){const value=useDefinitionDraft({scopeKey:scope});useEffect(()=>{draft=value},[value]);return null}
beforeEach(async()=>{mocks.import.mockReset();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);node=document.createElement('div');document.body.append(node);root=createRoot(node);await act(async()=>root.render(<Harness scope="company-a"/>))})
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals()})
const importFile=()=>draft.importFile({target:{files:[{name:'test.xlsx'}],value:'test'}})
it('cancels earlier imports when replaced, reset or switched to another company',async()=>{
  await act(async()=>importFile());const first=mocks.import.mock.calls[0][3].signal
  await act(async()=>importFile());expect(first.aborted).toBe(true)
  const second=mocks.import.mock.calls[1][3].signal
  await act(async()=>draft.reset());expect(second.aborted).toBe(true)
  await act(async()=>importFile());const third=mocks.import.mock.calls[2][3].signal
  await act(async()=>root.render(<Harness scope="company-b"/>));expect(third.aborted).toBe(true)
})
it('keeps the current draft when importing fails and replaces it only after success',async()=>{
  await act(async()=>draft.change(0,'label','Existing work'))
  await act(async()=>importFile())
  await act(async()=>mocks.import.mock.calls[0][2]('excelImport.format'))
  expect(draft.validRows[0].label).toBe('Existing work')
  await act(async()=>mocks.import.mock.calls[0][1]([{label:'Imported',data_type:'text'}]))
  expect(draft.validRows[0].label).toBe('Imported')
})
