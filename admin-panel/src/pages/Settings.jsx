const Settings = () => {
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Ajustes</h2>
          <p>Configura preferencias, roles y conexiones.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Guardar cambios</button>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Perfil</h3>
          <div className="form-grid">
            <label>
              Nombre
              <input className="input" defaultValue="Joselyn Mejía" />
            </label>
            <label>
              Email
              <input className="input" defaultValue="joselyn@email.com" />
            </label>
            <label>
              Teléfono
              <input className="input" defaultValue="+34 600 000 000" />
            </label>
          </div>
        </div>
        <div className="card">
          <h3>Supabase</h3>
          <div className="form-grid">
            <label>
              Proyecto
              <input className="input" defaultValue="regiamare-prod" />
            </label>
            <label>
              URL
              <input className="input" defaultValue="https://xxxx.supabase.co" />
            </label>
            <label>
              Clave pública
              <input className="input" defaultValue="public-anon-key" />
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Settings
