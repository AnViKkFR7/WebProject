import { Link } from 'react-router-dom'

const NotFound = () => {
  return (
    <div className="page-content">
      <div className="empty-state">
        <h2>Ruta no encontrada</h2>
        <p>La página que buscas no existe o fue movida.</p>
        <Link className="primary-button" to="/">
          Volver al dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFound
