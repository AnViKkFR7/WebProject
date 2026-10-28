import { supabase } from '../lib/supabaseClient'
import { analyticsService, summarizeDailyRows } from './analyticsService'
import { countBy, distinctItemTypes, ITEM_STATUSES, MEMBER_ROLES, nextTasks, sumBilling } from '../lib/companyOverview'
import { countByStatus } from '../lib/leads'

const ANALYTICS_DAYS = 30
const isoDay = (date) => date.toISOString().slice(0, 10)

export async function fetchRecentQuoteApprovalResponses(companyId){
  if(!companyId)return []
  const{data,error}=await supabase.rpc('get_company_recent_quote_approval_responses',{p_company:companyId,p_limit:5})
  if(error)throw error
  return data||[]
}

export async function markQuoteApprovalResponseHandled(companyId,responseId,handled=true){
  if(!companyId||!responseId)throw new Error('Missing company or quote response')
  const{data:{user},error:authError}=await supabase.auth.getUser()
  if(authError)throw authError
  if(!user)throw new Error('Authentication required')
  const{error}=await supabase.rpc('set_quote_approval_response_handled',{
    p_user:user.id,p_company:companyId,p_response:responseId,p_handled:handled,
  })
  if(error)throw error
}

/**
 * Todo lo que el Dashboard necesita de una empresa, en una sola llamada.
 * Cada bloque va por separado: si la analítica falla (o la empresa aún no la
 * tiene configurada), el resto del resumen se sigue viendo.
 */
export async function fetchCompanyOverview(companyId) {
  if (!companyId) return null

  const now = new Date()
  const from = new Date(now.getTime() - ANALYTICS_DAYS * 24 * 60 * 60 * 1000)
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [items, definitions, members, clients, tasks, bills, leads, analytics,quoteApprovals] = await Promise.all([
    supabase.from('items').select('status').eq('company_id', companyId),
    supabase.from('attribute_definitions').select('item_type').eq('company_id', companyId),
    supabase.from('company_members').select('role').eq('company_id', companyId),
    supabase.from('client_company').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('planning_task').select('id, title, start_datetime, client_company_id')
      .eq('company_id', companyId)
      .gte('start_datetime', now.toISOString())
      .lte('start_datetime', weekAhead.toISOString())
      .order('start_datetime', { ascending: true })
      .limit(20),
    supabase.from('billing').select('amount, direction, billing_date')
      .eq('company_id', companyId)
      .gte('billing_date', isoDay(now)),
    supabase.from('lead').select('status').eq('company_id', companyId),
    analyticsService.getDailyAnalytics(companyId, isoDay(from), isoDay(now)).catch(() => null),
    fetchRecentQuoteApprovalResponses(companyId).catch(()=>[]),
  ])

  const firstError = [items, definitions, members, clients, tasks, bills, leads].find(r => r.error)
  if (firstError) throw firstError.error

  const analyticsSummary = analytics ? summarizeDailyRows(analytics) : null

  return {
    items: {
      total: items.data.length,
      byStatus: countBy(items.data, 'status', ITEM_STATUSES),
    },
    content: {
      itemTypes: distinctItemTypes(definitions.data).length,
      attributes: definitions.data.length,
    },
    people: {
      total: members.data.length,
      byRole: countBy(members.data, 'role', MEMBER_ROLES),
    },
    clients: clients.count || 0,
    leads: countByStatus(leads.data),
    planning: {
      upcoming: tasks.data.length,
      next: nextTasks(tasks.data, 4, now),
      ...sumBilling(bills.data),
    },
    analytics: analyticsSummary && {
      days: ANALYTICS_DAYS,
      visitors: analyticsSummary.uniqueVisitors,
      pageViews: analyticsSummary.pageViews,
      available: analytics.length > 0,
    },
    quoteApprovals,
  }
}
