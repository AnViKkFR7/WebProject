import { useState } from 'react'

const Profile = () => {
  const [activeTab, setActiveTab] = useState('personal') // personal | security | company

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Mi Perfil</h2>
          <p>Gestiona tu información personal y preferencias.</p>
        </div>
      </section>

      <div>
        {/* Pestañas (Tabs) */}
        <div className="tabs-header">
          <button 
            className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            Información Personal
          </button>
          <button 
            className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            Seguridad
          </button>
          <button 
            className={`tab-button ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            Mi Organización
          </button>
        </div>

        {/* Contenido principal con estilo Tab Content Attached */}
        <main>
          
          {activeTab === 'personal' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Información Básica</h3>
                <p>Esta información será visible para otros miembros de tu empresa.</p>
              </div>
              
              <div className="form-grid">
                <div className="avatar-section">
                  <div className="avatar-large">JM</div>
                  <button className="ghost-button small">Cambiar foto</button>
                </div>

                <label className="form-group">
                  <span>Nombre Completo</span>
                  <input type="text" className="input" defaultValue="Joselyn Mejía" />
                </label>

                <label className="form-group">
                  <span>Correo Electrónico</span>
                  <input type="email" className="input" defaultValue="joselyn@email.com" disabled />
                  <span className="help-text">El email no se puede cambiar.</span>
                </label>

                <label className="form-group">
                  <span>Teléfono</span>
                  <input type="tel" className="input" defaultValue="+34 600 000 000" />
                </label>
              </div>

              <div className="card-footer">
                <button className="primary-button">Guardar cambios</button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Cambiar Contraseña</h3>
                <p>Asegúrate de usar una contraseña segura.</p>
              </div>
              <div className="form-grid">
                <label className="form-group full-width">
                  <span>Contraseña Actual</span>
                  <input type="password" class="input" />
                </label>
                <label className="form-group">
                  <span>Nueva Contraseña</span>
                  <input type="password" class="input" />
                </label>
                <label className="form-group">
                  <span>Confirmar Nueva</span>
                  <input type="password" class="input" />
                </label>
              </div>
              <div className="card-footer" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <button className="primary-button">Actualizar contraseña</button>
              </div>

              <div className="card-header">
                <h3>Sesiones Activas</h3>
              </div>
              <div className="table">
                <div className="table-row">
                  <span className="row-title">Windows PC - Chrome</span>
                  <span className="pill published">Actual</span>
                </div>
                <div className="table-row">
                  <span className="row-title">iPhone 13 - Safari</span>
                  <span className="text-secondary">Hace 2 días</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="tab-content animated-card">
              <div className="card-header">
                <h3>Mi Organización</h3>
                <p>Configuración rápida para editores.</p>
              </div>
              
              <div className="info-banner">
                <span className="icon">ℹ️</span>
                <p>Eres <strong>Editor</strong> en <em>Regiamare</em>. Tienes permisos para gestionar items y usuarios.</p>
              </div>

              <div className="settings-list">
                <div className="setting-item">
                  <div className="setting-info">
                    <h4>Logotipo de la empresa</h4>
                    <p>Visible en facturas y cabecera pública.</p>
                  </div>
                  <button className="ghost-button">Subir logo</button>
                </div>
                
                <div className="setting-item">
                  <div className="setting-info">
                    <h4>Notificaciones de equipo</h4>
                    <p>Recibir aviso cuando un miembro publique un item.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

export default Profile
