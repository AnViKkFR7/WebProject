import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'

/**
 * Tarjeta de resumen: un número grande, su desglose y un enlace a la pestaña
 * donde se trabaja con eso. La tarjeta entera es el enlace.
 */
const StatCard = ({ icon, title, value, hint, to, ctaLabel, children }) => (
  <article className="stat-card">
    <header className="stat-card-head">
      <span className="stat-card-icon"><Icon name={icon} size={18} /></span>
      <h3 className="stat-card-title">{title}</h3>
    </header>

    <p className="stat-card-value">{value}</p>
    {hint && <p className="stat-card-hint">{hint}</p>}

    {children && <div className="stat-card-body">{children}</div>}

    {to && (
      <Link className="stat-card-cta stretched-link" to={to}>
        {ctaLabel}
        <Icon name="chevronRight" size={14} />
      </Link>
    )}
  </article>
)

export default StatCard
