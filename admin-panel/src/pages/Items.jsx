const Items = () => {
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Items</h2>
          <p>Gestiona los elementos genéricos por empresa y tipo.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Nuevo item</button>
          <button className="ghost-button">Importar</button>
        </div>
      </section>

      <div className="card">
        <div className="toolbar">
          <div className="filter-group">
            <select className="select">
              <option>Todos los tipos</option>
              <option>Propiedad</option>
              <option>Producto</option>
              <option>Plato</option>
            </select>
            <select className="select">
              <option>Todos los estados</option>
              <option>Publicado</option>
              <option>Borrador</option>
              <option>Archivado</option>
            </select>
          </div>
          <button className="ghost-button small">Filtros avanzados</button>
        </div>

        <div className="table">
          <div className="table-row table-header">
            <span>Título</span>
            <span>Tipo</span>
            <span>Empresa</span>
            <span>Estado</span>
            <span>Actualizado</span>
          </div>
          {[
            {
              title: 'Departamento Las Palmas',
              type: 'Propiedad',
              company: 'Regiamare',
              status: 'Publicado',
              updated: 'Hace 2h',
            },
            {
              title: 'Apartamento Centro',
              type: 'Propiedad',
              company: 'Regiamare Norte',
              status: 'Borrador',
              updated: 'Hace 1d',
            },
            {
              title: 'Casa de Playa',
              type: 'Propiedad',
              company: 'Regiamare Sur',
              status: 'Archivado',
              updated: 'Hace 1s',
            },
          ].map((item) => (
            <div className="table-row" key={item.title}>
              <span className="row-title">{item.title}</span>
              <span>{item.type}</span>
              <span>{item.company}</span>
              <span>
                <span className={`pill ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </span>
              <span>{item.updated}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Items
