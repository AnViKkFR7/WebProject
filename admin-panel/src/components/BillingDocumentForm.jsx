import { changeIssuerSource, newLine } from '../lib/invoicing'
import QuoteLinesEditor from './QuoteLinesEditor'
import FormSection from './ui/FormSection'
import Toggle from './ui/Toggle'
import Icon from './ui/Icon'

export default function BillingDocumentForm({ editor, company, profile, hasSavedIssuer, locked, canEdit, saving, isQuote, field, profileFields, updateDoc, setEditor, saveIssuer, persist, statuses, label, t, money, error, errorRef, appearance }) {
  return (
      <form id="invoice-editor" noValidate onSubmit={persist} className="document-editor-layout">
        <div className="document-editor-main">
        <fieldset disabled={locked || saving} className="invoice-fieldset">
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
          <div className="invoice-fields">{['name','taxId','address','email'].map(k => field(k,editor.doc.customer[k],v => updateDoc({ customer:{ ...editor.doc.customer,[k]:v } }),{ required:k !== 'email',type:k === 'email' ? 'email' : 'text',maxLength:1000 }))}</div>
          </FormSection>
          <FormSection headingLevel={2} icon="planning" title={t('formDesign.documentDetails')} tone="teal" step="02">
          <div className="invoice-fields document-metadata-grid">{field('date',editor.doc.date,v => updateDoc({ date:v }),{ type:'date',required:true })}{field('dueDate',editor.doc.dueDate,v => updateDoc({ dueDate:v }),{ type:'date',min:editor.doc.date })}
          <label className="field invoice-field"><span className="field-label">{label('status')}</span><select className="select" value={editor.status} onChange={e => setEditor(p => ({ ...p,status:e.target.value }))}>{(locked ? [editor.status] : statuses.filter(s => !['invoiced','cancelled'].includes(s))).map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label></div>
          </FormSection>
          {isQuote && <FormSection headingLevel={2} icon="file" title={t('documentDesign.presentation')} tone="teal">
            <div className="invoice-fields">{['title','site'].map(key => <label className="field invoice-field" key={key}><span className="field-label">{t(`documentDesign.${key}`)}</span><input className="input" value={editor.doc.presentation?.[key] || ''} maxLength={300} onChange={e => updateDoc({ presentation:{ ...editor.doc.presentation,[key]:e.target.value } })}/></label>)}</div>
            {['introduction','conditions'].map(key => <label className="field invoice-field" key={key}><span className="field-label">{t(`documentDesign.${key}`)}</span><textarea className="input" rows={3} maxLength={2000} value={editor.doc.presentation?.[key] || ''} onChange={e => updateDoc({ presentation:{ ...editor.doc.presentation,[key]:e.target.value } })}/></label>)}
            <Toggle checked={editor.doc.presentation?.signatures !== false} label={t('documentDesign.signatures')} onChange={signatures => updateDoc({ presentation:{ ...editor.doc.presentation,signatures } })}/>
          </FormSection>}
          <FormSection headingLevel={2} icon="list" title={label('lines')} description={t('formDesign.linesHelp')} step="03" className="document-lines-section">
          {isQuote ? <QuoteLinesEditor lines={editor.doc.lines} onChange={lines=>updateDoc({lines})} field={field} label={label} t={t} money={money}/> : <>
          <div className="invoice-line-list">{editor.doc.lines.map((line,index) => <div className="invoice-line" key={index}><span className="invoice-line-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
            {['description','quantity','price','discount','tax'].map(k => field(k === 'description' ? 'descriptionLine' : k,line[k],v => updateDoc({ lines:editor.doc.lines.map((l,n) => n === index ? { ...l,[k]:v } : l) }), k === 'description' ? { required:true,maxLength:2000 } : { type:'number',required:true,min:k === 'quantity' ? '0.001' : '0',max:['discount','tax'].includes(k) ? '100' : undefined,step:k === 'quantity' ? '0.001' : '0.01' }))}
            <button type="button" className="ghost-button" disabled={editor.doc.lines.length === 1} aria-label={`${label('removeLine')} ${index+1}`} onClick={() => updateDoc({ lines:editor.doc.lines.filter((_,n) => n !== index) })}><Icon name="trash" size={16}/></button>

          </div>)}</div>
          <button type="button" className="ghost-button" onClick={() => updateDoc({ lines:[...editor.doc.lines,newLine()] })}><Icon name="plus" size={16}/>{label('addLine')}</button></>}

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
