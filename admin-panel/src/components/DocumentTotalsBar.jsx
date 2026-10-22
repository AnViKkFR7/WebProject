import styles from './DocumentTotalsBar.module.css'

export default function DocumentTotalsBar({totals,label,money,t}) {
  const rows=[['base','base'],['tax','taxTotal'],...(totals.retained ? [['retained','retained']] : []),['total','total']]
  return <aside className={styles.bar} aria-label={t('formDesign.summary')}>
    <span className={styles.title}>{t('formDesign.summary')}</span>
    <dl>{rows.map(([key,title])=><div key={key} className={key==='total'?styles.total:undefined}><dt>{label(title)}</dt><dd>{money(totals[key])}</dd></div>)}</dl>
  </aside>
}
