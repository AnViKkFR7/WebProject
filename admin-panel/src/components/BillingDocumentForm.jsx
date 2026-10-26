import { changeIssuerSource, newLine } from '../lib/invoicing'
import QuoteLinesEditor from './QuoteLinesEditor'
import FormSection from './ui/FormSection'
import Toggle from './ui/Toggle'
import Icon from './ui/Icon'
import BillingReusePanel from './BillingReusePanel'
import BillingChapterTemplates from './BillingChapterTemplates'

export default function BillingDocumentForm({ editor, company, profile, hasSavedIssuer, locked, canEdit, saving, isQuote, field, profileFields, updateDoc, setEditor, saveIssuer, persist, statuses, label, t, money, error, errorRef, appearance, reuse, onReuseRetry, onCreateClient, onCreateCatalogItem, onArchiveCatalogItem, templates, onTemplateRetry, onApplyTemplate, onSaveTemplate, onArchiveTemplate }) {
  return (
      <form id="invoice-editor" noValidate onSubmit={persist} className="document-editor-layout">
        <div className="document-editor-main">
        {!isQuote && ['issued','paid'].includes(editor.invoice?.status) && <p className="form-note" role="note">{t('invoicing.issuedImmutable')}</p>}
        <fieldset disabled={locked || saving} className="invoice-fieldset">
          {editor.rectificationSource && <FormSection headingLevel={2} icon="file" title={t('rectification.section')} description={`${t('rectification.help')} ${t(`rectification.${editor.doc.rectification.method}Help`)}`} step="00">
            <p className="form-note">{t('rectification.original').replace('{number}',editor.rectificationSource.number)}</p>
            <div className="invoice-fields">
              <label className="field invoice-field"><span className="field-label">{t('rectification.method')}</span><select className="select" value={editor.doc.rectification.method} onChange={event=>{
                const method=event.target.value
                updateDoc({rectification:{...editor.doc.rectification,method},lines:editor.doc.lines.map(line=>{const next={...line};delete next.sign;return method==='difference'?{...next,sign:-1}:next})})
              }}><option value="difference">{t('rectification.difference')}</option><option value="substitution">{t('rectification.substitution')}</option></select></label>
              <label className="field invoice-field"><span className="field-label">{t('rectification.cause')}</span><select className="select" value={editor.doc.rectification.cause} onChange={event=>updateDoc({rectification:{...editor.doc.rectification,cause:event.target.value}})}>
                {['required_data','incorrect_tax','article_80','other'].map(value=><option key={value} value={value}>{t(`rectification.causes.${value}`)}</option>)}
              </select></label>
            </div>
            <label className="field invoice-field"><span className="field-label">{t('rectification.note')}</span><textarea className="input" rows={3} maxLength={2000} required value={editor.doc.rectification.note} onChange={event=>updateDoc({rectification:{...editor.doc.rectification,note:event.target.value}})}/></label>
          </FormSection>}
          <section className="invoice-issuer-section">
            <div className="issuer-source-row"><span className="issuer-source-icon"><Icon name="companies" size={22}/></span><div className="issuer-source-control">
            <Toggle checked={editor.useCompanyIssuer} disabled={locked || saving || !hasSavedIssuer}
              label={label('useCompanyIssuer').replace('{company}',company.name)}
              description={!hasSavedIssuer ? label('missingIssuer') : undefined}
              onChange={checked => setEditor(prev => changeIssuerSource(prev,checked,profile))}/>
            </div>{editor.useCompanyIssuer && <span className="issuer-source-check" aria-hidden="true"><Icon name="check" size={16}/></span>}</div>
            {editor.useCompanyIssuer ? <p className="field-help">{editor.doc.issuer.name} · {editor.doc.issuer.taxId} · {editor.doc.issuer.address}</p> : <>
              <h2>{label('issuer')}</h2>{profileFields(editor.doc.issuer,issuer => updateDoc({ issuer }),false,['name','taxId','address','email','phone'])}
              {canEdit && !locked && <button type="button" className="ghost-button" disabled={saving} onClick={saveIssuer}>{label('saveIssuer')}</button>}
            </>}
          </section>
          {appearance}
          <FormSection headingLevel={2} icon="users" title={label('customer')} description={t('formDesign.customerHelp')} step="01">
          <BillingReusePanel mode="client" entries={reuse.clients} loading={reuse.loading} error={reuse.error} disabled={locked || saving} onRetry={onReuseRetry} onCreate={onCreateClient} t={t}
            onSelect={client=>updateDoc({customer:{name:client.name || '',taxId:client.tax_id || client.taxId || '',address:client.billing_address || client.address || '',email:client.email || ''}})}/>
          <div className="invoice-fields">{['name','taxId','address','email'].map(k => field(k,editor.doc.customer[k],v => updateDoc({ customer:{ ...editor.doc.customer,[k]:v } }),{ required:k !== 'email',type:k === 'email' ? 'email' : 'text',maxLength:1000 }))}</div>
          </FormSection>
          <FormSection headingLevel={2} icon="planning" title={t('formDesign.documentDetails')} tone="teal" step="02">
          <div className="invoice-fields document-metadata-grid">{field('date',editor.doc.date,v => updateDoc({ date:v }),{ type:'date',required:true })}{field('dueDate',editor.doc.dueDate,v => updateDoc({ dueDate:v }),{ type:'date',min:editor.doc.date })}
          {!editor.rectificationSource && <label className="field invoice-field"><span className="field-label">{label('status')}</span><select className="select" value={editor.status} onChange={e => setEditor(p => ({ ...p,status:e.target.value }))}>{(locked ? [editor.status] : statuses.filter(s => !['invoiced','cancelled'].includes(s) && !( !isQuote && s==='paid'))).map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>}</div>
          {editor.duplicateSource && <p className="form-note" role="status">{label('duplicateDates').replace('{number}',editor.duplicateSource)}</p>}
          </FormSection>
          {isQuote && <FormSection headingLevel={2} icon="file" title={t('documentDesign.presentation')} tone="teal">
            <div className="invoice-fields">{['title','site'].map(key => <label className="field invoice-field" key={key}><span className="field-label">{t(`documentDesign.${key}`)}</span><input className="input" value={editor.doc.presentation?.[key] || ''} maxLength={300} onChange={e => updateDoc({ presentation:{ ...editor.doc.presentation,[key]:e.target.value } })}/></label>)}</div>
            {['introduction','conditions'].map(key => <label className="field invoice-field" key={key}><span className="field-label">{t(`documentDesign.${key}`)}</span><textarea className="input" rows={3} maxLength={2000} value={editor.doc.presentation?.[key] || ''} onChange={e => updateDoc({ presentation:{ ...editor.doc.presentation,[key]:e.target.value } })}/></label>)}
            <Toggle checked={editor.doc.presentation?.signatures !== false} label={t('documentDesign.signatures')} onChange={signatures => updateDoc({ presentation:{ ...editor.doc.presentation,signatures } })}/>
          </FormSection>}
          <FormSection headingLevel={2} icon="list" title={label('lines')} description={t('formDesign.linesHelp')} step="03" className="document-lines-section">
          <BillingReusePanel mode="catalog" entries={reuse.catalog} loading={reuse.loading} error={reuse.error} disabled={locked || saving} onRetry={onReuseRetry} onCreate={onCreateCatalogItem} onArchive={onArchiveCatalogItem} t={t}
            onSelect={item=>{
              const description=[item.name,item.description,item.unit && `(${item.unit})`].filter(Boolean).join(' · ')
              const line={...newLine(),description,price:Number(item.price),tax:Number(item.tax)}
              const empty=editor.doc.lines.length===1 && !editor.doc.lines[0].description
              updateDoc({lines:empty ? [line] : [...editor.doc.lines,line]})
            }}/>
          {isQuote && <BillingChapterTemplates templates={templates.items} lines={editor.doc.lines} loading={templates.loading} error={templates.error} disabled={locked || saving} onRetry={onTemplateRetry} onApply={onApplyTemplate} onSave={onSaveTemplate} onArchive={onArchiveTemplate} t={t}/>}
          {isQuote ? <QuoteLinesEditor lines={editor.doc.lines} onChange={lines=>updateDoc({lines})} field={field} label={label} t={t} money={money}/> : <>
          <div className="invoice-line-list">{editor.doc.lines.map((line,index) => <div className="invoice-line" key={index}><span className="invoice-line-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
            {['description','quantity','price','discount','tax'].map(k => field(k === 'description' ? 'descriptionLine' : k,line[k],v => updateDoc({ lines:editor.doc.lines.map((l,n) => n === index ? { ...l,[k]:v } : l) }), k === 'description' ? { required:true,maxLength:2000 } : { type:'number',required:true,min:k === 'quantity' ? '0.001' : '0',max:['discount','tax'].includes(k) ? '100' : undefined,step:k === 'quantity' ? '0.001' : '0.01' }))}
            {editor.rectificationSource && editor.doc.rectification.method==='difference' && <button type="button" className="ghost-button" aria-label={t(line.sign===-1 ? 'rectification.negativeLine' : 'rectification.positiveLine')} title={t('rectification.toggleSign')} onClick={()=>updateDoc({lines:editor.doc.lines.map((item,n)=>n===index?{...item,sign:item.sign===-1?1:-1}:item)})}>{line.sign===-1?'−':'+'}</button>}
            <button type="button" className="ghost-button" disabled={editor.doc.lines.length === 1} aria-label={`${label('removeLine')} ${index+1}`} onClick={() => updateDoc({ lines:editor.doc.lines.filter((_,n) => n !== index) })}><Icon name="trash" size={16}/></button>

          </div>)}</div>
          <button type="button" className="ghost-button" onClick={() => updateDoc({ lines:[...editor.doc.lines,{...newLine(),...(editor.rectificationSource&&editor.doc.rectification.method==='difference'?{sign:1}:{})}] })}><Icon name="plus" size={16}/>{label('addLine')}</button></>}

          </FormSection>
          <FormSection headingLevel={2} icon="file" title={t('formDesign.paymentDetails')} tone="amber" step="04">
          <div className="invoice-fields">{field('withholding',editor.doc.withholding,v => updateDoc({ withholding:v }),{ type:'number',min:0,max:100,step:'0.01',required:true })}{['payment','iban','notes'].map(k => field(k,editor.doc[k],v => updateDoc({ [k]:v }),{ maxLength:2000 }))}</div>
          </FormSection>
        </fieldset>
        <p ref={errorRef} tabIndex={-1} className="field-error" role={error ? "alert" : undefined}>{error}</p>
        </div>

      </form>
  )
}
