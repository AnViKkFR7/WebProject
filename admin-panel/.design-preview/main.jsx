import React from 'react'
import {createRoot} from 'react-dom/client'
import {createMemoryRouter,RouterProvider} from 'react-router-dom'
import {LanguageProvider,useLanguage} from '../src/contexts/LanguageContext'
import {FeedbackProvider} from '../src/contexts/FeedbackContext'
import Invoicing from '../src/pages/Invoicing'
import '../src/index.css'
import '../src/App.css'
import '../src/styles/forms.css'
const query=new URLSearchParams(location.search)
const kind=query.get('kind')==='invoice'?'invoice':'quote'
const router=createMemoryRouter([{path:kind==='quote'?'/quotes/*':'/invoicing/*',element:<Invoicing kind={kind}/>}],{initialEntries:[(kind==='quote'?'/quotes/':'/invoicing/')+(query.has('new')?'new':'demo-document')]})
function ReviewControls(){const {toggleLanguage}=useLanguage();return <div style={{position:'fixed',bottom:12,left:12,zIndex:20,display:'flex',gap:8}}><button onClick={()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'}}>Tema de prueba</button><button onClick={toggleLanguage}>Idioma de prueba</button></div>}
createRoot(document.getElementById('root')).render(<LanguageProvider><FeedbackProvider><ReviewControls/><div className='review-shell'><nav className='review-sidebar'><strong>ARQUELIA</strong><p>Mi espacio</p><p>Planning</p><p>Presupuestos</p><p>Facturación</p></nav><main className='review-main'><RouterProvider router={router}/></main></div></FeedbackProvider></LanguageProvider>)
