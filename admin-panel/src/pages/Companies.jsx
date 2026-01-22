const Companies = () => {
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Empresas</h2>
          <p>Administra las empresas y su información de contacto.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Nueva empresa</button>
          <button className="ghost-button">Invitar usuario</button>
        </div>
      </section>

      <div className="card">
        <div className="table">
          <div className="table-row table-header">
            <span>Empresa</span>
            <span>Contacto</span>
            <span>Usuarios</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          {[
            {
              name: 'Regiamare',
              email: 'hola@regiamare.com',
              users: 18,
              status: 'Activa',
            },
            {
              name: 'Regiamare Norte',
              email: 'norte@regiamare.com',
              users: 9,
              status: 'Activa',
            },
            {
              name: 'Regiamare Sur',
              email: 'sur@regiamare.com',
              users: 6,
              status: 'Pendiente',
            },
          ].map((company) => (
            <div className="table-row" key={company.name}>
              <span className="row-title">{company.name}</span>
              <span>{company.email}</span>
              <span>{company.users} usuarios</span>
              <span>
                <span className={`pill ${company.status === 'Activa' ? 'published' : 'draft'}`}>
                  {company.status}
                </span>
              </span>
              <span>
                <button className="ghost-button small">Gestionar</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Companies
