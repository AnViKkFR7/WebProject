// Envía los recordatorios por email de las tareas de Planning.
//
// La llama el cron de la base de datos cada 5 minutos
// (ver database/migrations/PLANNING_REMINDERS.sql). No la llama el panel.
//
// Secretos necesarios:
//   RESEND_API_KEY        clave de Resend (o del proveedor de email que uséis)
//   REMINDERS_FROM_EMAIL  remitente verificado, p. ej. "Panel <avisos@tu-dominio.com>"
//   REMINDERS_CRON_SECRET cadena larga al azar; es lo único que autoriza a
//                         llamar a esta función. El mismo valor va en Vault,
//                         que es de donde lo lee el cron.
//   SUPABASE_DB_KEY       (opcional) clave con la que leer la base de datos.
//                         Ponla si usas las claves nuevas (sb_secret_...). Si
//                         no está, se usa la SUPABASE_SERVICE_ROLE_KEY que
//                         Supabase inyecta sola (en desuso, pero sigue valiendo).
//
// Se despliega SIN verificación de JWT, porque quien llama es el cron de la
// base de datos y no trae un token de usuario:
//   supabase functions deploy send-planning-reminders --no-verify-jwt
// La función queda accesible públicamente, pero sin la cabecera
// x-reminders-secret responde 403 y no hace nada.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { buildPlanningReminder, type DueReminder, type ReminderTask } from '../_shared/planningReminder.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  // Admite las claves nuevas (sb_secret_...) y la antigua service role key
  const dbKey = Deno.env.get('SUPABASE_DB_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('REMINDERS_CRON_SECRET')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REMINDERS_FROM_EMAIL')

  if (!cronSecret) return json({ error: 'Missing REMINDERS_CRON_SECRET' }, 500)

  // La autorización va PRIMERO: esta función es pública (se despliega con
  // --no-verify-jwt), así que a quien no se identifique no se le cuenta qué
  // configuración le falta. El motivo del 403 sí se distingue, para poder
  // depurarlo sin enseñar el secreto.
  const providedSecret = req.headers.get('x-reminders-secret')
  if (!providedSecret || providedSecret === 'null') {
    return json({ error: 'Forbidden', reason: 'falta la cabecera x-reminders-secret' }, 403)
  }
  if (providedSecret !== cronSecret) {
    return json({ error: 'Forbidden', reason: 'el secreto no coincide con REMINDERS_CRON_SECRET' }, 403)
  }

  if (!supabaseUrl || !dbKey) return json({ error: 'Missing SUPABASE_URL or SUPABASE_DB_KEY' }, 500)
  if (!resendKey || !from) return json({ error: 'Missing RESEND_API_KEY or REMINDERS_FROM_EMAIL' }, 500)

  const admin = createClient(supabaseUrl, dbKey)

  const { data: due, error } = await admin.rpc('due_planning_reminders', { window_minutes: 10 })
  if (error) {
    console.error('[REMINDERS] rpc failed', error)
    return json({ error: error.message }, 500)
  }

  const reminders = (due ?? []) as DueReminder[]
  if (reminders.length === 0) return json({ sent: 0 })

  // El destinatario es quien creó la tarea
  const userIds = [...new Set(reminders.map(r => r.created_by).filter(Boolean))] as string[]
  const emails = new Map<string, string>()
  for (const id of userIds) {
    const { data, error: userError } = await admin.auth.admin.getUserById(id)
    if (userError) console.error('[REMINDERS] user lookup failed', id, userError)
    if (data?.user?.email) emails.set(id, data.user.email)
  }

  let sent = 0
  const failed: string[] = []

  for (const reminder of reminders) {
    const to = reminder.created_by ? emails.get(reminder.created_by) : undefined
    if (!to) continue
    // Service credentials bypass RLS: recheck membership immediately before sending.
    const { data: membership, error: memberError } = await admin.from('company_members')
      .select('user_id').eq('company_id',reminder.company_id).eq('user_id',reminder.created_by).eq('is_active',true).maybeSingle()
    if (memberError) { failed.push(`${reminder.task_id}: membership lookup failed`); continue }
    if (!membership) continue

    try {
      const {data:task,error:taskError}=await admin.from('planning_task')
        .select('id,company_id,created_by,title,description,start_datetime,end_datetime,is_all_day,type,recurrence_type,client_company_id')
        .eq('id',reminder.task_id).eq('company_id',reminder.company_id).maybeSingle()
      if(taskError) throw new Error('Task lookup failed')
      if(!task || task.created_by!==reminder.created_by) continue
      const {data:company,error:companyError}=await admin.from('companies').select('name').eq('id',reminder.company_id).single()
      if(companyError) throw new Error('Company lookup failed')
      let clientName:string|null=null
      if(task.client_company_id) {
        const {data:client,error:clientError}=await admin.from('client_company').select('name').eq('id',task.client_company_id).eq('company_id',reminder.company_id).maybeSingle()
        if(clientError) throw new Error('Client lookup failed')
        clientName=client?.name || null
      }
      const message=buildPlanningReminder(reminder,task as ReminderTask,company?.name || 'Tu compañía',clientName)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject:message.subject,html:message.html,text:message.text,
        }),
      })

      if (!response.ok) {
        failed.push(`${reminder.task_id}: ${await response.text()}`)
        continue
      }

      // Se marca como enviado solo si el email salió: así un fallo se reintenta
      // en la siguiente pasada del cron, dentro de la ventana de 10 minutos.
      const { error: markError } = await admin.from('planning_reminder_sent').insert({
        task_id: reminder.task_id,
        minutes_before: reminder.minutes_before,
        occurrence_at: message.occurrenceAt,
      })
      if (markError) console.error('[REMINDERS] could not mark as sent', markError)
      sent += 1
    } catch (err) {
      failed.push(`${reminder.task_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (failed.length > 0) console.error('[REMINDERS] failures', failed)
  return json({ sent, failed: failed.length })
})
