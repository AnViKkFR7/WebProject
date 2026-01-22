const Blog = () => {
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Blog</h2>
          <p>Publica y gestiona artículos para cada empresa.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Nuevo post</button>
          <button className="ghost-button">Borradores</button>
        </div>
      </section>

      <div className="card">
        <div className="table">
          <div className="table-row table-header">
            <span>Título</span>
            <span>Empresa</span>
            <span>Estado</span>
            <span>Actualizado</span>
            <span>Acciones</span>
          </div>
          {[
            {
              title: 'Guía para comprar vivienda',
              company: 'Regiamare',
              status: 'Publicado',
              updated: 'Hace 3d',
            },
            {
              title: 'Tendencias 2026',
              company: 'Regiamare Norte',
              status: 'Borrador',
              updated: 'Hace 1w',
            },
            {
              title: 'Checklist de venta',
              company: 'Regiamare',
              status: 'Archivado',
              updated: 'Hace 2w',
            },
          ].map((post) => (
            <div className="table-row" key={post.title}>
              <span className="row-title">{post.title}</span>
              <span>{post.company}</span>
              <span>
                <span className={`pill ${post.status.toLowerCase()}`}>
                  {post.status}
                </span>
              </span>
              <span>{post.updated}</span>
              <span>
                <button className="ghost-button small">Editar</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Blog
