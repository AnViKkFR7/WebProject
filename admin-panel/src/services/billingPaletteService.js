import { supabase } from '../lib/supabaseClient'
import { validBillingPalette, validPaletteName } from '../lib/billingAppearance'

const validEntry = (entry,companyId) => typeof entry?.id==='string' && entry.id.length>0 && entry.company_id===companyId && validPaletteName(entry.name) && validBillingPalette(entry.palette) && entry.palette.id==='custom'

export async function loadBillingPalettes(companyId) {
  const entries=[]
  for(let offset=0;;offset+=500) {
    const {data,error}=await supabase.from('billing_color_palettes').select('id,company_id,name,palette')
      .eq('company_id',companyId).order('name').order('id').range(offset,offset+499)
    if(error) throw error
    if(!Array.isArray(data) || !data.every(entry=>validEntry(entry,companyId))) throw new Error('Invalid palette library')
    entries.push(...data)
    if(data.length<500) return entries
  }
}

export async function saveBillingPalette(companyId,name,palette) {
  if(!validPaletteName(name) || !validBillingPalette(palette) || palette.id!=='custom') throw new Error('Invalid palette')
  const {data,error}=await supabase.rpc('save_billing_color_palette',{p_company:companyId,p_name:name.trim(),p_palette:palette})
  if(error) throw error
  if(!validEntry(data,companyId)) throw new Error('Invalid saved palette')
  return data
}
