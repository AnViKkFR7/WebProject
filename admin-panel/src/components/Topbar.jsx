const Topbar = () => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">Panel de administración</h1>
        <p className="topbar-subtitle">Multi-tenant · Supabase · React</p>
      </div>
      <div className="topbar-right">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="search"
            placeholder="Buscar items, empresas, usuarios..."
            aria-label="Buscar"
          />
        </div>
        <button className="ghost-button">Crear</button>
        <div className="user-chip">
          <div className="user-avatar">JM</div>
          <div>
            <div className="user-name">Joselyn</div>
            <div className="user-role">Admin</div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
