import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const LegalNotice = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', marginBottom: '1rem', fontSize: '1rem' }}>
             ← {t('common.back') || 'Volver'}
          </button>
          <h2>Aviso Legal y Condiciones de Uso</h2>
        </div>
      </section>

      <div className="card" style={{ padding: '2rem', maxWidth: '800px' }}>
        <h3>1. Información General</h3>
        <p>
          Esta plataforma web es una herramienta de administración privada y de acceso restringido. 
          El acceso está limitado estrictamente a los usuarios autorizados por los administradores del sistema.
        </p>

        <h3>2. Condiciones de Acceso y Uso</h3>
        <ul>
          <li><strong>Acceso Personal:</strong> Las credenciales de acceso (usuario y contraseña) son personales e intransferibles. El usuario es responsable de su custodia.</li>
          <li><strong>Uso Autorizado:</strong> El usuario se compromete a utilizar la plataforma únicamente para las finalidades de gestión asignadas por su organización.</li>
          <li><strong>Prohibiciones:</strong> Queda prohibido intentar acceder a datos de otras organizaciones, realizar ingeniería inversa, o utilizar la plataforma para fines ilícitos o no autorizados.</li>
        </ul>

        <h3>3. Propiedad Intelectual</h3>
        <p>
          Todo el software, código fuente, diseños e interfaces de esta plataforma son propiedad exclusiva de sus desarrolladores o titulares de los derechos de explotación. El acceso a la herramienta no implica la cesión de ningún derecho de propiedad intelectual sobre la misma.
        </p>

        <h3>4. Exención de Responsabilidad</h3>
        <p>
          Los administradores no se hacen responsables de los daños derivados del mal uso de la plataforma por parte de los usuarios, ni de las interrupciones del servicio ocasionadas por causas de fuerza mayor o mantenimiento técnico.
        </p>

        <h3>5. Modificaciones</h3>
        <p>
          Nos reservamos el derecho a modificar estas condiciones de uso en cualquier momento para adaptarlas a novedades legislativas o cambios en la funcionalidad de la herramienta.
        </p>
      </div>
    </div>
  )
}

export default LegalNotice
