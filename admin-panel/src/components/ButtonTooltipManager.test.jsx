// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import ButtonTooltipManager from './ButtonTooltipManager'

let host,root
beforeEach(()=>vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true))
afterEach(()=>{act(()=>root?.unmount());host?.remove();vi.unstubAllGlobals()})

it('adds hover labels from visible text and accessible labels, including dynamic buttons',async()=>{
  host=document.createElement('div')
  host.innerHTML='<button>Guardar presupuesto</button><button aria-label="Cerrar panel"></button><button title="Ayuda específica">i</button><button><svg role="img" aria-label="Descargar factura"></svg></button><button id="crm-switch" role="switch"><span></span></button><label for="crm-switch"><span>Activar CRM</span><span>Permite gestionar contactos</span></label>'
  document.body.append(host)
  root=createRoot(document.createElement('div'))
  act(()=>root.render(<ButtonTooltipManager/>))
  const [save,close,help,download,crmSwitch]=host.querySelectorAll('button')
  expect(save.title).toBe('Guardar presupuesto')
  expect(close.title).toBe('Cerrar panel')
  expect(close.getAttribute('aria-label')).toBe('Cerrar panel')
  expect(help.title).toBe('Ayuda específica')
  expect(download.title).toBe('Descargar factura')
  expect(download.getAttribute('aria-label')).toBe('Descargar factura')
  expect(crmSwitch.title).toBe('Activar CRM')
  expect(crmSwitch.getAttribute('aria-label')).toBe('Activar CRM')

  const dynamic=document.createElement('button')
  dynamic.textContent='Enviar invitación'
  await act(async()=>{host.append(dynamic);await new Promise(resolve=>setTimeout(resolve,0))})
  expect(dynamic.title).toBe('Enviar invitación')
})
