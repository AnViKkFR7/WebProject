const Users = () => {
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Usuarios</h2>
          <p>Gestiona los roles y el acceso por empresa.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Nuevo usuario</button>
          <button className="ghost-button">Exportar</button>
        </div>
      </section>

      <div className="card">
        <div className="table">
          <div className="table-row table-header">
            <span>Usuario</span>
            <span>Empresa</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          {[
            {
              name: 'Joselyn Mejía',
              company: 'Regiamare',
              role: 'Admin',
              status: 'Activo',
            },
            {
              name: 'Carlos Gómez',
              company: 'Regiamare Norte',
              role: 'Editor',
              status: 'Activo',
            },
            {
              name: 'Ana Ortega',
              company: 'Regiamare Sur',
              role: 'Viewer',
              status: 'Pendiente',
            },
          ].map((user) => (
            <div className="table-row" key={user.name}>
              <span className="row-title">{user.name}</span>
              <span>{user.company}</span>
              <span>
                <span className="badge">{user.role}</span>
              </span>
              <span>
                <span className={`pill ${user.status === 'Activo' ? 'published' : 'draft'}`}>
                  {user.status}
                </span>
              </span>
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

export default Users
