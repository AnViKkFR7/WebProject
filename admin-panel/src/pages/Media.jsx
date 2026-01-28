const Media = () => {
  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Media</h2>
          <p>Gestiona imágenes y documentos vinculados a items y blog.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Subir archivo</button>
          <button className="ghost-button">Crear carpeta</button>
        </div>
      </section>

      <div className="media-grid">
        {[
          { name: 'Frente de casa', type: 'Imagen', size: '1.4 MB' },
          { name: 'Plano arquitectónico', type: 'PDF', size: '740 KB' },
          { name: 'Departamento 3D', type: 'Imagen', size: '2.2 MB' },
          { name: 'Contrato base', type: 'PDF', size: '320 KB' },
        ].map((file) => (
          <div className="card media-card" key={file.name}>
            <div className="media-preview">
              <span>{file.type === 'PDF' ? '📄' : '🖼️'}</span>
            </div>
            <div>
              <strong>{file.name}</strong>
              <p>
                {file.type} · {file.size}
              </p>
            </div>
            <button className="ghost-button small">Ver</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Media
