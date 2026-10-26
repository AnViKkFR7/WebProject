import { draftFingerprint, isDraftDocument, readDraftRecovery, removeDraftRecovery, writeDraftRecovery } from './documentDrafts'

// One writer per mounted user/company/kind/document. Network responses never replace current input.
export class DocumentDraftSession {
  constructor({scope,document,baseVersion,service,onChange,onRecover,storage}) {
    Object.assign(this,{scope,current:document,baseVersion,service,onChange,onRecover,storage})
    this.baseline=draftFingerprint(document);this.ack='';this.row=null;this.ready=false;this.active=true;this.paused=false;this.status='loading'
    this.candidates={};this.pending=null;this.inFlight=null;this.timer=null;this.localUnavailable=false;this.finished=false;this.epoch=0
  }
  notify() {if(this.active)this.onChange({status:this.status,ready:this.ready,busy:Boolean(this.discarding),completedRecord:this.completed,candidates:this.candidates,localUnavailable:this.localUnavailable,protectedFingerprint:this.ready && !this.candidates.local && !this.candidates.remote && this.status==='saved' ? this.ack : '',gate:this.status==='loading' || Boolean(this.candidates.local || this.candidates.remote)})}
  start(){this.active=true;return this.initialize()}
  setRecoveryHandler(handler){this.onRecover=handler}
  backup() {
    if(!this.active || this.finished || Object.keys(this.candidates).length || draftFingerprint(this.current)===this.baseline && !this.row)return
    this.localUnavailable=!writeDraftRecovery(this.scope,{document:this.current,baseVersion:this.baseVersion,draftVersion:this.row?.version || 0,draftId:this.row?.id,writeId:this.pending?.id},this.storage)
  }
  async initialize() {
    const epoch=++this.epoch
    this.ready=false;this.status='loading';this.notify()
    const local=readDraftRecovery(this.scope,this.storage)
    try {
      const row=await this.service.load(this.scope,local?.draftId)
      if(!this.active || epoch!==this.epoch)return
      this.row=row?.id ? row : null;this.completed=row?.completed_record || null
      this.candidates={...(this.row ? {remote:{document:this.row.document,baseVersion:this.row.base_version}} : {}),...(local && (!this.row || draftFingerprint(local.document)!==draftFingerprint(this.row.document)) ? {local:{...local,completed:Boolean(this.completed)}} : {})}
      this.ready=true;this.status=Object.keys(this.candidates).length ? 'recovery' : 'idle';this.notify()
    } catch(error) {
      if(!this.active || epoch!==this.epoch)return
      this.unavailable=['PGRST202','42883'].includes(error.code)
      this.candidates=local ? {local} : {};this.status=this.unavailable ? 'unavailable' : 'error';this.notify()
    }
  }
  update(document) {
    const previous=draftFingerprint(this.current);this.current=document
    if(!this.active || this.finished || previous===draftFingerprint(document))return
    clearTimeout(this.timer)
    if(!this.ready && !Object.keys(this.candidates).length && !this.paused){this.timer=setTimeout(()=>{this.backup();this.notify()},1000);return}
    if(!this.ready || Object.keys(this.candidates).length || this.paused || ['conflict','forbidden'].includes(this.status))return
    if(draftFingerprint(document)===this.ack){this.status='saved';this.notify();return}
    this.status='pending';this.notify()
    this.timer=setTimeout(()=>{this.backup();this.saveNow().catch(()=>{})},1000)
  }
  async saveNow(document=this.current,manual=false) {
    if(!this.active || this.finished || this.paused && !manual || !this.ready || Object.keys(this.candidates).length || this.status==='conflict' || this.status==='forbidden')throw new Error('Draft not ready')
    if(this.inFlight){await this.inFlight;if(!this.active)throw new Error('Draft closed');return this.saveNow(document,manual)}
    const fingerprint=draftFingerprint(document)
    if(this.row && fingerprint===this.ack)return this.row
    if(!isDraftDocument(document)){this.status='error';this.notify();throw new Error('Invalid draft structure')}
    const snapshot=structuredClone(document)
    const epoch=this.epoch
    if(this.pending?.fingerprint!==fingerprint)this.pending={fingerprint,id:crypto.randomUUID()}
    this.status='saving';this.notify()
    this.inFlight=(async()=>{
      try {
        const row=await this.service.save(this.scope,snapshot,this.baseVersion,this.row?.version || 0,this.pending.id)
        if(!this.active || epoch!==this.epoch)throw new Error('Draft closed')
        this.row=row;this.ack=fingerprint;this.pending=null;this.status=draftFingerprint(this.current)===fingerprint ? 'saved' : 'pending';this.backup();this.notify();return row
      } catch(error) {
        if(this.active && epoch===this.epoch){this.status=error.code==='40001' ? 'conflict' : ['42501','PGRST301'].includes(error.code) ? 'forbidden' : globalThis.navigator?.onLine===false ? 'offline' : 'error';this.backup();this.notify()}
        throw error
      } finally {this.inFlight=null}
    })()
    return this.inFlight
  }
  recover(source) {
    if(this.discarding)return
    const candidate=this.candidates[source]
    if(!candidate || candidate.completed || candidate.baseVersion!==this.baseVersion)return
    this.current=structuredClone(candidate.document);this.candidates={};this.ack=this.row ? draftFingerprint(this.row.document) : '';this.onRecover(this.current)
    this.status=this.ready && draftFingerprint(this.current)===this.ack ? 'saved' : this.ready ? 'pending' : 'error';this.backup();this.notify()
    if(this.ready && this.status==='pending')this.timer=setTimeout(()=>this.saveNow().catch(()=>{}),1000)
  }
  async discard() {
    if(!this.active || this.discarding)return
    this.discarding=true;this.notify()
    try {
      if(!this.ready)throw new Error('Load the server version first')
      if(this.row)await this.service.remove(this.scope,this.row.version)
      if(!this.active)return
      this.row=null;this.ack='';this.pending=null;this.candidates={};removeDraftRecovery(this.scope,this.storage);this.status='idle';this.notify()
    } catch(error){if(this.active){this.status=error.code==='40001' ? 'conflict' : 'error';this.notify()}}
    finally{this.discarding=false;this.notify()}
  }
  async prepare(document) {
    if(this.unavailable && !Object.keys(this.candidates).length)return undefined
    clearTimeout(this.timer);this.paused=true;this.current=document
    try {const row=await this.saveNow(document,true);return {id:row.id,version:row.version,key:this.scope.key}}
    catch(error){this.paused=false;throw error}
  }
  complete() {this.finished=true;clearTimeout(this.timer);removeDraftRecovery(this.scope,this.storage)}
  failed(error) {this.paused=false;if(error?.code==='40001'){this.status='conflict';this.notify()}}
  destroy() {this.backup();this.active=false;this.epoch++;clearTimeout(this.timer)}
}
