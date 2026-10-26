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
//   DEPLOYMENT_ENV/APP_VERSION (opcionales, no secretos) metadata mínima de logs.
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
const logEnvironments = new Set(['development', 'test', 'ci', 'staging', 'production'])
const logEnvironment = Deno.env.get('DEPLOYMENT_ENV')
const logVersion = Deno.env.get('APP_VERSION')
const operationalEnvironment = logEnvironments.has(logEnvironment || '') ? logEnvironment : 'unknown'
const operationalVersion = logVersion && /^[a-zA-Z0-9._+-]{1,40}$/.test(logVersion) ? logVersion : 'unversioned'
const logOperationalFailure = (code: string, databaseCode?: string, httpStatus?: number) => console.error('[REMINDERS]', {
  event: 'operation_failed', code, environment: operationalEnvironment,
  version: operationalVersion, occurredAt: new Date().toISOString(),
  ...(databaseCode ? { databaseCode } : {}),
  ...(Number.isInteger(httpStatus) ? { httpStatus } : {}),
})

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

  const { data: enqueued, error: enqueueError } = await admin.rpc('enqueue_due_planning_emails', { p_window_minutes: 10 })
  if (enqueueError) {
    // SQLSTATE/PostgREST code and HTTP status identify missing migrations,
    // permissions, or schema-cache issues without logging error text or data.
    const databaseCode = typeof enqueueError.code === 'string' && /^[A-Z0-9_]{3,12}$/.test(enqueueError.code)
      ? enqueueError.code
      : undefined
    const httpStatus = Number.isInteger(enqueueError.status) ? enqueueError.status : undefined
    logOperationalFailure('enqueue_failed', databaseCode, httpStatus)
    return json({ error: 'queue_unavailable', ...(databaseCode ? { code: databaseCode } : {}) }, 500)
  }
  const { data: batch, error: claimError } = await admin.rpc('claim_planning_email_batch', { p_limit: 25 })
  if (claimError) {
    logOperationalFailure('claim_failed')
    return json({ error: 'queue_unavailable' }, 500)
  }

  const jobs = (batch ?? []) as Array<{
    queue_id: string; task_id: string; company_id: string; recipient_id: string
    minutes_before: number; occurrence_at: string; attempt_count: number; delivery_generation: number
  }>
  let sent = 0
  let failed = 0
  for (const job of jobs) {
    const fail = async (code: string, retryable = true, providerId: string | null = null) => {
      const { error: failError } = await admin.rpc('fail_planning_email', {
        p_queue: job.queue_id, p_error_code: code, p_retryable: retryable, p_provider_id: providerId,
      })
      if (failError) logOperationalFailure('failure_update_failed')
      failed += 1
    }

    let providerAccepted = false
    let providerMessageId: string | null = null
    try {
      const { data: planningModule, error: moduleError } = await admin.from('company_modules')
        .select('is_enabled').eq('company_id', job.company_id).eq('module_key', 'planning').maybeSingle()
      if (moduleError) { await fail('unexpected_failure'); continue }
      if (planningModule && !planningModule.is_enabled) continue

      // El destinatario y el contenido se vuelven a leer al entregar el mensaje.
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(job.recipient_id)
      if (userError || !userData?.user?.email) { await fail('recipient_unavailable', false); continue }
      const { data: membership, error: memberError } = await admin.from('company_members')
        .select('user_id').eq('company_id', job.company_id).eq('user_id', job.recipient_id).eq('is_active', true).maybeSingle()
      if (memberError) { await fail('unexpected_failure'); continue }
      if (!membership) { await fail('membership_inactive', false); continue }

      const { data: task, error: taskError } = await admin.from('planning_task')
        .select('id,company_id,created_by,title,description,start_datetime,end_datetime,is_all_day,type,recurrence_type,client_company_id')
        .eq('id', job.task_id).eq('company_id', job.company_id).maybeSingle()
      if (taskError) { await fail('task_lookup_failed'); continue }
      if (!task || task.created_by !== job.recipient_id) { await fail('task_unavailable', false); continue }

      const { data: company, error: companyError } = await admin.from('companies')
        .select('name').eq('id', job.company_id).single()
      if (companyError) { await fail('company_lookup_failed'); continue }
      let clientName: string | null = null
      if (task.client_company_id) {
        const { data: client, error: clientError } = await admin.from('client_company')
          .select('name').eq('id', task.client_company_id).eq('company_id', job.company_id).maybeSingle()
        if (clientError) { await fail('client_lookup_failed'); continue }
        clientName = client?.name || null
      }

      const reminder: DueReminder = {
        task_id: job.task_id, company_id: job.company_id, created_by: job.recipient_id,
        minutes_before: job.minutes_before, occurrence_at: job.occurrence_at,
      }
      const message = buildPlanningReminder(reminder, task as ReminderTask, company.name || 'Tu compañía', clientName)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `planning-reminder/${job.queue_id}/${job.delivery_generation}`,
        },
        body: JSON.stringify({ from, to: userData.user.email, subject: message.subject, html: message.html, text: message.text }),
      })
      if (!response.ok) {
        // Resend 409 indica otra petición con esa misma clave en curso; es seguro reintentarlo.
        const retryable = response.status >= 500 || response.status === 409 || response.status === 429
        await fail(retryable ? 'provider_unavailable' : 'provider_rejected', retryable)
        continue
      }

      providerAccepted = true
      const providerResponse = await response.json().catch(() => ({})) as { id?: string }
      providerMessageId = providerResponse.id ?? null
      const { data: completed, error: completeError } = await admin.rpc('complete_planning_email', {
        p_queue: job.queue_id, p_provider_id: providerMessageId,
      })
      if (completeError || !completed) { await fail('sent_marker_failed', false, providerMessageId); continue }
      sent += 1
    } catch {
      // Once Resend accepts the message, automatic/manual re-send is unsafe;
      // retain the provider ID and ask an operator to verify delivery first.
      if (providerAccepted) await fail('sent_marker_failed', false, providerMessageId)
      else await fail('unexpected_failure')
    }
  }

  if (failed > 0) logOperationalFailure('batch_has_failures')
  return json({ enqueued: Number(enqueued) || 0, sent, failed })
})
