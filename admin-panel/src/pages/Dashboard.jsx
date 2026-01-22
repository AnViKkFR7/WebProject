const Dashboard = () => {
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Resumen general</h2>
          <p>Vista rápida de la actividad de tus empresas y contenidos.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Nuevo item</button>
          <button className="ghost-button">Nueva empresa</button>
        </div>
      </section>

      <section className="stats-grid">
        <div className="card stat-card">
          <p className="stat-label">Items publicados</p>
          <h3>128</h3>
          <span className="stat-trend positive">+12% este mes</span>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Empresas activas</p>
          <h3>6</h3>
          <span className="stat-trend neutral">0 cambios</span>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Usuarios</p>
          <h3>42</h3>
          <span className="stat-trend positive">+4 nuevos</span>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Posts publicados</p>
          <h3>15</h3>
          <span className="stat-trend negative">-1 esta semana</span>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Actividad reciente</h3>
            <button className="ghost-button small">Ver todo</button>
          </div>
          <ul className="activity-list">
            <li>
              <span className="badge">Item</span>
              <div>
                <strong>Departamento Las Palmas</strong>
                <p>Actualizado por Ana · Hace 2h</p>
              </div>
            </li>
            <li>
              <span className="badge">Blog</span>
              <div>
                <strong>Guía para comprar vivienda</strong>
                <p>Publicado por Carlos · Hace 1d</p>
              </div>
            </li>
            <li>
              <span className="badge">Empresa</span>
              <div>
                <strong>Regiamare Norte</strong>
                <p>Creada por Admin · Hace 2d</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Items por estado</h3>
            <button className="ghost-button small">Configurar</button>
          </div>
          <div className="progress-list">
            <div>
              <div className="progress-label">
                <span>Publicado</span>
                <span>68%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '68%' }} />
              </div>
            </div>
            <div>
              <div className="progress-label">
                <span>Borrador</span>
                <span>22%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill warning" style={{ width: '22%' }} />
              </div>
            </div>
            <div>
              <div className="progress-label">
                <span>Archivado</span>
                <span>10%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill neutral" style={{ width: '10%' }} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
