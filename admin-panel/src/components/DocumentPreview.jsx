import { useEffect, useState } from 'react'
import { createDocumentPdf } from '../lib/invoicingPdf'
import Icon from './ui/Icon'
import styles from './DocumentPreview.module.css'

export default function DocumentPreview({ invoice, t, language, kind }) {
  const [preview,setPreview] = useState(null)
  const [failed,setFailed] = useState(false)
  const [retry,setRetry] = useState(0)
  const [page,setPage] = useState(0)
  useEffect(() => {
    // Wait for a short typing pause; a large PDF must not run on every keystroke.
    const timer = setTimeout(() => {
      try {
        const pdf = createDocumentPdf(invoice,t,language,kind)
        const url = URL.createObjectURL(pdf.output('blob'))
        setPreview({ url,pages:pdf.previewPages }); setPage(value=>Math.min(value,pdf.previewPages.length-1)); setFailed(false)
      } catch { setFailed(true) }
    },200)
    return () => clearTimeout(timer)
  },[invoice,t,language,kind,retry])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) },[preview])
  const currentPage = Math.max(0,Math.min(page,(preview?.pages.length || 1)-1))
  return failed ? <div role="alert"><p>{t('invoicing.invalid')}</p><button type="button" className="ghost-button" onClick={() => setRetry(value=>value+1)}>{t('invoicing.retry')}</button></div> : <div className="document-pdf-preview">
    {!preview && <div className="document-preview-placeholder" role="status">{t('common.loading')}</div>}
    {preview && <><nav className={styles.controls} aria-label={t('documentPreview.pages')}>
      <button type="button" className={styles.pageButton} aria-label={t('documentPreview.previous')} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><Icon name="chevronLeft" size={18}/></button>
      <label className={styles.pageSelect}><span>{t('documentPreview.page')}</span><select aria-label={t('documentPreview.page')} value={currentPage} onChange={event=>setPage(Number(event.target.value))}>{preview.pages.map((_,index)=><option key={index} value={index}>{index+1}</option>)}</select><span>{t('documentPreview.of')} {preview.pages.length}</span></label>
      <button type="button" className={styles.pageButton} aria-label={t('documentPreview.next')} disabled={currentPage>=preview.pages.length-1} onClick={()=>setPage(currentPage+1)}><Icon name="chevronRight" size={18}/></button>
      <a className={styles.openLink} href={preview.url} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>{t('documentDesign.openPdf')}</a>
      </nav>
      <svg key={currentPage} className="document-page" viewBox="0 0 210 297" role="img" aria-label={`${t('invoicing.preview')} ${currentPage+1}`}>
        <rect width="210" height="297" fill="white"/>
        {preview.pages[currentPage].map((item,index) => {
          const {type,...props}=item
          if (type === 'text') return <text key={index} x={item.x} y={item.y} fontFamily="Helvetica, Arial, sans-serif" fontSize={item.size} fontWeight={item.bold ? 700 : 400} fill={item.color} textAnchor={item.align === 'right' ? 'end' : item.align === 'center' ? 'middle' : 'start'} xmlSpace="preserve">{item.value}</text>
          if (type === 'image') return <image key={index} {...props}/>
          if (type === 'line') { const {color,...line}=props; return <line key={index} {...line} stroke={color} strokeWidth=".25"/> }
          return <rect key={index} {...props} strokeWidth=".25"/>
        })}
      </svg>
    </>}
  </div>
}
