import { supabase } from '../lib/supabaseClient'
import { isDraftDocument } from '../lib/documentDrafts'
const call=(name,args)=>supabase.rpc(name,args).abortSignal(AbortSignal.timeout(10000))
const checked=(row,scope)=>{
  if(row===null)return null
  if(row?.completed_record) {
    if(row.completed_record.company_id!==scope.companyId || typeof row.completed_record.id!=='string' || !isDraftDocument(row.completed_record.document))throw new Error('Invalid completed draft response')
    if(!row.id)return row
  }
  if(!row || row.company_id!==scope.companyId || row.owner_id!==scope.userId || row.kind!==scope.kind || row.document_key!==scope.key || !Number.isInteger(row.version) || row.version<1 || typeof row.id!=='string' || !isDraftDocument(row.document))throw new Error('Invalid draft response')
  return row
}
export async function loadDocumentDraft(scope,previousId) {
  const {data,error}=await call('get_billing_draft',{p_company:scope.companyId,p_kind:scope.kind,p_key:scope.key,p_previous:previousId || null})
  if(error)throw error
  return checked(data,scope)
}
export async function saveDocumentDraft(scope,document,baseVersion,version,writeId) {
  if(!isDraftDocument(document))throw new Error('Invalid draft document')
  const {data,error}=await call('save_billing_draft',{p_company:scope.companyId,p_kind:scope.kind,p_key:scope.key,p_document:document,p_base_version:baseVersion,p_version:version,p_write:writeId})
  if(error)throw error
  const row=checked(data,scope)
  if(!row)throw new Error('Missing saved draft')
  return row
}
export async function deleteDocumentDraft(scope,version) {
  const {error}=await call('delete_billing_draft',{p_company:scope.companyId,p_kind:scope.kind,p_key:scope.key,p_version:version})
  if(error)throw error
}
