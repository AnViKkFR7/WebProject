import { useMemo, useState } from 'react'
import FormSection from '../components/ui/FormSection'
import Toggle from '../components/ui/Toggle'
import DocumentActionButton from '../components/ui/DocumentActionButton'
import { buildPlanningReminder } from '../../../supabase/functions/_shared/planningReminder.ts'
import styles from './DeveloperGallery.module.css'

const sampleTask={id:'demo-task',company_id:'demo-company',created_by:'demo-user',title:'Revisar propuesta de verano',description:'Repasar presupuesto y confirmar los cambios con el cliente.',start_datetime:'2026-10-27T09:00:00+02:00',end_datetime:'2026-10-27T10:00:00+02:00',is_all_day:false,type:'reunion',recurrence_type:'none'}
const sampleReminder={task_id:sampleTask.id,company_id:sampleTask.company_id,created_by:sampleTask.created_by,minutes_before:60,occurrence_at:sampleTask.start_datetime}

// Sentinel used by the production-output check: DEV_ONLY_ADMIN_GALLERY_SENTINEL
export default function DeveloperGallery(){
  const [enabled,setEnabled]=useState(true)
  const email=useMemo(()=>buildPlanningReminder(sampleReminder,sampleTask,'Tienda de ejemplo','Cliente de muestra'),[])
  return <main className={styles.page}>
    <header><p className={styles.eyebrow}>Solo desarrollo</p><h1>Galería de componentes y email</h1><p>Datos ficticios; no guarda cambios ni envía mensajes.</p></header>
    <div className={styles.grid}>
      <FormSection title="Acciones" description="Botones de uso habitual" icon="grid" headingLevel={2}>
        <div className={styles.row}><DocumentActionButton>Acción principal</DocumentActionButton><DocumentActionButton variant="outline">Secundaria</DocumentActionButton><DocumentActionButton variant="danger">Destructiva</DocumentActionButton></div>
      </FormSection>
      <FormSection title="Campos y estados" description="Entrada, ayuda, aviso e interruptor" icon="grid" headingLevel={2}>
        <label className={styles.field}>Nombre de ejemplo<input defaultValue="Servicio de temporada"/></label>
        <p className={styles.hint}>La ayuda contextual describe el formato.</p>
        <div className={styles.alert} role="status">Ejemplo de estado informativo.</div>
        <Toggle checked={enabled} onChange={setEnabled} label="Recordatorio activo" description="Control interactivo de muestra"/>
      </FormSection>
      <FormSection title="Email de Planning" description="La plantilla real con datos ficticios" icon="grid" headingLevel={2}>
        <div className={styles.emailMeta}><strong>{email.subject}</strong><span>Vista previa HTML; mensaje sin enviar.</span></div>
        <iframe className={styles.emailFrame} title="Vista previa del recordatorio de Planning" sandbox="" srcDoc={email.html}/>
        <details><summary>Versión de texto</summary><pre>{email.text}</pre></details>
      </FormSection>
    </div>
  </main>
}
