import { invoiceTotals, newLine } from '../lib/invoicing'
import Icon from './ui/Icon'

import { quoteChapters } from '../lib/quoteChapters'
import {billingLineId,moveBillingChapter,moveBillingLine} from '../lib/billingTemplates'

export default function QuoteLinesEditor({lines,onChange,field,label,t,money}) {
  const groups=quoteChapters(lines)
  const totals=invoiceTotals(lines)
  const change=(index,key,value)=>onChange(lines.map((line,n)=>n===index ? {...line,[key]:value} : line))
  const addChapter=()=>{
    const next=Math.max(0,...groups.map(group=>Number.parseInt(group.chapter,10)||0))+1
    onChange([...lines,{...newLine(),id:billingLineId(),chapter:`${String(next).padStart(2,'0')} · ${t('quoteEditor.newChapter')}`}])
  }
  return <div className="quote-chapters">
    {groups.map(group=><section key={group.firstIndex} className="quote-chapter-card">
      <header className="quote-chapter-heading">
        <label className="field"><span className="field-label">{t('quoteEditor.chapter')}</span><input className="input" aria-label={`${t('quoteEditor.chapter')} ${groups.indexOf(group)+1}`} maxLength={200} defaultValue={group.chapter} placeholder={t('quoteEditor.general')}
          onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}}}
          onBlur={event=>{const name=event.target.value.trim();onChange(lines.map((line,index)=>group.rows.some(row=>row.index===index) ? {...line,chapter:name} : line))}}/></label>
        <div><span>{t('quoteEditor.chapterSubtotal')}</span><strong>{money(group.rows.reduce((sum,row)=>sum+Math.round(totals.rows[row.index].base*100),0)/100)}</strong></div>
        <div className="quote-move-actions"><button type="button" className="ghost-button" disabled={groups.indexOf(group)===0} aria-label={`${t('quoteEditor.moveChapterUp')} ${group.chapter}`} onClick={()=>onChange(moveBillingChapter(lines,group.chapter,-1))}><Icon name="chevronUp" size={16}/></button><button type="button" className="ghost-button" disabled={groups.indexOf(group)===groups.length-1} aria-label={`${t('quoteEditor.moveChapterDown')} ${group.chapter}`} onClick={()=>onChange(moveBillingChapter(lines,group.chapter,1))}><Icon name="chevronDown" size={16}/></button></div>
      </header>
      {group.rows.map(({line,index},position)=><div className="quote-item" key={line.id || index}>
        <div className="invoice-line"><span className="invoice-line-number" aria-hidden="true">{String(position+1).padStart(2,'0')}</span>
          {['description','quantity','price','discount','tax'].map(key=>field(key==='description' ? 'descriptionLine' : key,line[key],value=>change(index,key,value),key==='description' ? {required:true,maxLength:2000} : {type:'number',required:true,min:key==='quantity'?'.001':'0',max:['discount','tax'].includes(key)?'100':undefined,step:key==='quantity'?'.001':'.01'}))}
          <button type="button" className="ghost-button" disabled={lines.length===1} aria-label={`${label('removeLine')} ${index+1}`} onClick={()=>onChange(lines.filter((_,n)=>n!==index))}><Icon name="trash" size={16}/></button>
          <div className="quote-line-move"><button type="button" className="ghost-button" disabled={position===0} aria-label={`${t('quoteEditor.moveItemUp')} ${position+1}`} onClick={()=>onChange(moveBillingLine(lines,line.id,-1))}><Icon name="chevronUp" size={15}/></button><button type="button" className="ghost-button" disabled={position===group.rows.length-1} aria-label={`${t('quoteEditor.moveItemDown')} ${position+1}`} onClick={()=>onChange(moveBillingLine(lines,line.id,1))}><Icon name="chevronDown" size={15}/></button></div>
        </div>
        {Number(line.discount)>0 && <p className="quote-price-breakdown"><span>{t('quoteEditor.before')}: {money(totals.rows[index].original)}</span><span>{t('quoteEditor.discountAmount')}: −{money(totals.rows[index].discount)} ({line.discount}%)</span><strong>{t('quoteEditor.after')}: {money(totals.rows[index].base)}</strong></p>}
        <details className="quote-work-details"><summary>{t('documentDesign.details')}</summary><textarea className="input" aria-label={`${t('documentDesign.details')} ${index+1}`} maxLength={2000} rows={3} value={line.details || ''} onChange={event=>change(index,'details',event.target.value)}/></details>
      </div>)}
      <button type="button" className="quote-add-item" onClick={()=>{
        const at=group.rows.at(-1).index+1
        onChange([...lines.slice(0,at),{...newLine(),id:billingLineId(),chapter:group.chapter},...lines.slice(at)])
      }}><Icon name="plus" size={15}/>{t('quoteEditor.addItem')}</button>
    </section>)}
    <button type="button" className="ghost-button" onClick={addChapter}><Icon name="plus" size={16}/>{t('quoteEditor.addChapter')}</button>
  </div>
}
