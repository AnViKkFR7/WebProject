import { useLanguage } from '../../contexts/LanguageContext'
import { engagementStats } from '../../lib/analyticsEvents'
import StatBreakdown from '../dashboard/StatBreakdown'

// Rojo en el tramo de rebote, neutro en medio y verde en las lecturas largas
const TONE = {
  lt10: 'var(--danger-color)',
  '10_30': 'var(--text-tertiary)',
  '30_60': 'var(--text-tertiary)',
  '60_180': 'var(--success-color)',
  gt180: 'var(--success-color)',
}

/** Cuánto tiempo pasa la gente en cada página, contando solo con la pestaña visible. */
const TimeOnPageCard = ({ byEngagement }) => {
  const { t } = useLanguage()
  const { total, rows, bounceRate } = engagementStats(byEngagement)

  return (
    <div className="card analytics-card">
      <h3 className="analytics-card-title">{t('analytics.timeTitle')}</h3>
      <p className="field-help analytics-card-help">{t('analytics.timeHelp')}</p>

      {total === 0 ? (
        <p className="text-muted">{t('analytics.noData')}</p>
      ) : (
        <>
          <p className="bounce-figure">
            <strong>{bounceRate}%</strong>
            <span>{t('analytics.bounceLabel')}</span>
          </p>
          <StatBreakdown
            total={total}
            rows={rows.map(row => ({
              key: row.key,
              label: t(`analytics.time_${row.key}`),
              value: row.value,
              tone: TONE[row.key],
            }))}
          />
        </>
      )}
    </div>
  )
}

export default TimeOnPageCard
