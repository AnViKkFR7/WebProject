import {supabase} from '../lib/supabaseClient'

export async function loadCustomerEmailSettings(companyId){
  const{data,error}=await supabase.rpc('get_company_customer_email_settings',{p_company:companyId})
  if(error)throw error
  if(!data||typeof data!=='object')throw new Error('Customer email settings unavailable')
  return data
}

export async function saveCustomerEmailSettings(companyId,settings){
  const{data,error}=await supabase.rpc('save_company_customer_email_settings',{p_company:companyId,p_settings:settings})
  if(error)throw error
  return data
}

export async function loadCustomerEmailRevisions(companyId){
  const{data,error}=await supabase.rpc('get_company_customer_email_revisions',{p_company:companyId})
  if(error)throw error
  return Array.isArray(data)?data:[]
}

export async function restoreCustomerEmailRevision(companyId,revisionId){
  const{data,error}=await supabase.rpc('restore_company_customer_email_revision',{p_company:companyId,p_revision:revisionId})
  if(error)throw error
  return data
}
