import { useLanguage } from '../../contexts/LanguageContext'
import { toChartData } from '../../services/analyticsService'

/** Páginas que la gente pidió y no existen: enlaces rotos o contenido que se movió. */
const NotFoundCard = ({ byNotFound }) => {
  const { t } = useLanguage()
  const rows = toChartData(byNotFound, 8)

  return (
    <div className="card analytics-card">
      <h3 className="analytics-card-title">{t('analytics.notFoundTitle')}</h3>
      <p className="field-help analytics-card-help">{t('analytics.notFoundHelp')}</p>

      {rows.length === 0 ? (
        <p className="text-muted">{t('analytics.notFoundNone')}</p>
      ) : (
        <ul className="rank-list">
          {rows.map(row => (
            <li key={row.name}>
              <span className="rank-name" title={row.name}>{row.name}</span>
              <span className="rank-value">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default NotFoundCard
