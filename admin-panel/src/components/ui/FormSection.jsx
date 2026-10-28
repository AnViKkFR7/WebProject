import { useId } from 'react'
import Icon from './Icon'

export default function FormSection({ title, description, icon = 'grid', step, tone = 'indigo', children, className = '', headingLevel = 4, collapsible = false, collapsed = false, onToggleCollapse, collapseLabel, expandLabel }) {
  const titleId = useId()
  const contentId = useId()
  const Heading = headingLevel === 2 ? 'h2' : headingLevel === 3 ? 'h3' : 'h4'
  return <section className={`form-section form-section-${tone} ${className}`.trim()} aria-labelledby={titleId}>
    <header className="form-section-heading">
      <span className="form-section-icon"><Icon name={icon} size={18}/></span>
      <div><Heading id={titleId}>{title}</Heading>{description && <p>{description}</p>}</div>
      {step && <span className="form-section-step" aria-hidden="true">{step}</span>}
      {collapsible && <button type="button" className="form-section-toggle" aria-expanded={!collapsed} aria-controls={contentId} aria-label={collapsed ? expandLabel : collapseLabel} title={collapsed ? expandLabel : collapseLabel} onClick={onToggleCollapse}><Icon name={collapsed ? 'chevronDown' : 'chevronUp'} size={18}/><span>{collapsed ? expandLabel : collapseLabel}</span></button>}
    </header>
    <div id={contentId} className="form-section-content" hidden={collapsed}>{children}</div>
  </section>
}
