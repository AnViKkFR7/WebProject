// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {createMemoryRouter,RouterProvider} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {es} from '../locales/es'
const mock=vi.hoisted(()=>({save:vi.fn()}))
const profile={name:'Emisor',taxId:'A123',address:'Madrid',prefix:'F',quotePrefix:'P'}
vi.mock('../contexts/CompanyContext',()=>({useCompany:()=>({selectedCompany:{id:'company-a',name:'Company A'},user:{id:'user'}})}))
vi.mock('../hooks/usePermissions',()=>({usePermissions:()=>({canEdit:true})}))
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({language:'es',t:key=>key.split('.').reduce((v,k)=>v?.[k],es)||key})}))
vi.mock('../contexts/FeedbackContext',()=>({useFeedback:()=>({toast:{success:vi.fn(),error:vi.fn()},confirm:vi.fn()})}))
vi.mock('../services/invoicingService',()=>({loadInvoicing:async()=>({invoices:[],profile,profileVersion:1}),saveInvoice:(...args)=>mock.save(...args),saveProfile:vi.fn(),convertQuote:vi.fn()}))
vi.mock('./DocumentPreview',()=>({default:()=>null}))
import Invoicing from '../pages/Invoicing'
let root,node
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);node=document.createElement('div');document.body.append(node);root=createRoot(node)})
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals()})
const button=text=>[...document.querySelectorAll('button')].find(item=>item.textContent===text)
const click=async element=>act(async()=>element.click())
it('adds several independent items to a chapter and creates a separate new chapter',async()=>{
  const router=createMemoryRouter([{path:'/quotes/*',element:<Invoicing kind="quote"/>}],{initialEntries:['/quotes']})
  await act(async()=>root.render(<RouterProvider router={router}/>))
  await click(button('Nuevo presupuesto'))
  expect(document.querySelectorAll('.quote-chapter-card')).toHaveLength(1)
  await click(button('Añadir partida a este capítulo'))
  expect(document.querySelectorAll('.quote-chapter-card')[0].querySelectorAll('.quote-item')).toHaveLength(2)
  await click(button('Añadir partida a este capítulo'))
  expect(document.querySelectorAll('.quote-item')).toHaveLength(3)
  await click(button('Añadir capítulo'))
  expect(document.querySelectorAll('.quote-chapter-card')).toHaveLength(2)
  expect(document.querySelectorAll('.quote-chapter-card')[0].querySelectorAll('.quote-item')).toHaveLength(3)
  expect(document.querySelectorAll('.quote-chapter-card')[1].querySelectorAll('.quote-item')).toHaveLength(1)
})
