import Icon from './Icon'

/** Estado vacío: qué pasa aquí y qué hacer. `action` suele ser un botón. */
const EmptyState = ({ icon = 'items', title, description, action, compact = false }) => (
  <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
    <span className="empty-state-icon"><Icon name={icon} size={compact ? 22 : 28} /></span>
    {title && <h3 className="empty-state-title">{title}</h3>}
    {description && <p className="empty-state-description">{description}</p>}
    {action && <div className="empty-state-action">{action}</div>}
  </div>
)

export default EmptyState
