import {supabase} from '../lib/supabaseClient'

const assertCompany=(row,companyId)=>{
  if(!row || row.company_id!==companyId || typeof row.name!=='string' || !Array.isArray(row.lines) || !row.lines.length)throw new Error('Invalid chapter template scope')
  return row
}
export async function loadBillingChapterTemplates(companyId) {
  const {data,error}=await supabase.from('billing_chapter_templates').select('*').eq('company_id',companyId).is('archived_at',null).order('name').limit(500)
  if(error)throw error
  return (data || []).map(row=>assertCompany(row,companyId))
}
export async function saveBillingChapterTemplate(companyId,{name,lines}) {
  const {data,error}=await supabase.rpc('save_billing_chapter_template',{p_company:companyId,p_name:name,p_lines:lines})
  if(error)throw error
  return assertCompany(data,companyId)
}
export async function archiveBillingChapterTemplate(companyId,id) {
  const {error}=await supabase.rpc('archive_billing_chapter_template',{p_company:companyId,p_id:id})
  if(error)throw error
}
