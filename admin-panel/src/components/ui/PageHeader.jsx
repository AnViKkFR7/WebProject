/** Cabecera de página: título, descripción opcional y acciones a la derecha. */
const PageHeader = ({ title, description, actions, children }) => (
  <header className="page-header">
    <div className="page-header-text">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
    {actions && <div className="header-actions">{actions}</div>}
  </header>
)

export default PageHeader
