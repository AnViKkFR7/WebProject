import {supabase} from '../lib/supabaseClient'

const checkCompany=(row,companyId,label)=>{
  if(!row || row.company_id!==companyId || typeof row.id!=='string')throw new Error(`Invalid ${label} response`)
  return row
}
export async function loadBillingReuse(companyId) {
  const [clients,catalog]=await Promise.all([
    supabase.from('client_company').select('id,company_id,name,tax_id,billing_address,email,phone,responsible,color').eq('company_id',companyId).is('archived_at',null).order('name'),
    supabase.from('billing_catalog_items').select('*').eq('company_id',companyId).is('archived_at',null).order('name'),
  ])
  if(clients.error)throw clients.error
  if(catalog.error)throw catalog.error
  return {
    clients:clients.data.map(row=>checkCompany(row,companyId,'client')),
    catalog:catalog.data.map(row=>checkCompany(row,companyId,'catalogue')),
  }
}
export async function saveBillingClient(companyId,client) {
  const {data,error}=await supabase.rpc('save_client_company',{
    p_company:companyId,p_id:null,p_name:client.name,p_tax_id:client.taxId,p_billing_address:client.address,p_email:client.email || '',
    p_phone:client.phone || '',p_responsible:client.responsible || '',p_color:'#1976d2',
  })
  if(error)throw error
  return checkCompany(data,companyId,'client')
}
export async function saveBillingCatalogItem(companyId,item) {
  const {data,error}=await supabase.rpc('save_billing_catalog_item',{
    p_company:companyId,p_id:null,p_name:item.name,p_description:item.description || '',p_unit:item.unit || '',p_price:item.price,p_tax:item.tax,
  })
  if(error)throw error
  return checkCompany(data,companyId,'catalogue')
}
export async function archiveBillingCatalogItem(companyId,id) {
  const {error}=await supabase.rpc('archive_billing_catalog_item',{p_company:companyId,p_id:id})
  if(error)throw error
}
