import { useLanguage } from '../../contexts/LanguageContext'
import { SCROLL_THRESHOLDS, scrollRows } from '../../lib/analyticsEvents'

/**
 * Hasta dónde se lee cada página. Cada celda es el porcentaje de las visitas
 * de esa página que llegó a ese punto: una página que se abandona arriba se
 * ve en rojo de un vistazo, sin tener que interpretar números.
 */
const ScrollDepthCard = ({ byScroll, byPath }) => {
  const { t } = useLanguage()
  const rows = scrollRows(byScroll, byPath, 8)

  return (
    <div className="card analytics-card">
      <h3 className="analytics-card-title">{t('analytics.scrollTitle')}</h3>
      <p className="field-help analytics-card-help">{t('analytics.scrollHelp')}</p>

      {rows.length === 0 ? (
        <p className="text-muted">{t('analytics.noData')}</p>
      ) : (
        <div className="depth-table-wrap" role="region" aria-label={t('analytics.scrollTitle')} tabIndex={0}>
          <table className="depth-table">
            <thead>
              <tr>
                <th scope="col">{t('analytics.page')}</th>
                {SCROLL_THRESHOLDS.map(threshold => (
                  <th key={threshold} scope="col" className="is-number">{threshold}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.path}>
                  <th scope="row" title={row.path}>{row.path}</th>
                  {SCROLL_THRESHOLDS.map(threshold => (
                    <td
                      key={threshold}
                      className="is-number depth-cell"
                      // El tono va por variable CSS: la intensidad depende del dato
                      style={{ '--depth': row.percent[threshold] }}
                    >
                      {row.percent[threshold]}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ScrollDepthCard
