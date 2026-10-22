import { percentOf } from '../../lib/companyOverview'

/**
 * Desglose de un total en partes, con una barra proporcional.
 * rows: [{ key, label, value, tone }]
 */
const StatBreakdown = ({ rows, total }) => (
  <dl className="breakdown">
    {rows.map(row => (
      <div key={row.key} className="breakdown-row">
        <dt>{row.label}</dt>
        <dd>
          <span className="breakdown-value">{row.value}</span>
          <span className="breakdown-bar" aria-hidden="true">
            <span
              className="breakdown-fill"
              style={{ width: `${percentOf(row.value, total)}%`, '--tone': row.tone }}
            />
          </span>
        </dd>
      </div>
    ))}
  </dl>
)

export default StatBreakdown
