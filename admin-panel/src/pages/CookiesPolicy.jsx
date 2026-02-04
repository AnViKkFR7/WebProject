import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const CookiesPolicy = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', marginBottom: '1rem', fontSize: '1rem' }}>
             ← {t('common.back') || 'Volver'}
          </button>
          <h2>Política de Cookies</h2>
        </div>
      </section>

      <div className="card" style={{ padding: '2rem', maxWidth: '800px' }}>
        <h3>1. ¿Qué son las cookies?</h3>
        <p>
          Una cookie es un pequeño fichero de texto que se almacena en su navegador cuando accede a determinadas páginas web. Las cookies permiten a una página web, entre otras cosas, almacenar y recuperar información sobre los hábitos de navegación de un usuario o de su equipo y, dependiendo de la información que contengan y de la forma en que utilice su equipo, pueden utilizarse para reconocer al usuario.
        </p>

        <h3>2. Cookies utilizadas en este sitio web</h3>
        <p>
          Al ser una plataforma de administración privada, este sitio web utiliza <strong>únicamente cookies técnicas y de sesión</strong>, que son estrictamente necesarias para el funcionamiento de la aplicación.
        </p>
        <p>
          <strong>No utilizamos cookies publicitarias ni de terceros para rastreo comercial.</strong>
        </p>

        <h4>Tipos de cookies que usamos:</h4>
        <ul>
          <li>
            <strong>Cookies de Autenticación (Supabase):</strong> Permiten identificar al usuario durante su sesión para que no tenga que introducir su contraseña cada vez que cambia de página. 
            Son imprescindibles para acceder a las áreas privadas.
          </li>
          <li>
            <strong>Cookies de Preferencias:</strong> Almacenan configuraciones locales del usuario, como el idioma seleccionado o la preferencia de modo claro/oscuro.
          </li>
          <li>
            <strong>Cookies de Seguridad:</strong> Utilizadas para prevenir ataques a la web y garantizar la seguridad de la conexión.
          </li>
        </ul>

        <h3>3. Base legal</h3>
        <p>
          De acuerdo con la normativa vigente (artículo 22.2 de la LSSI), las cookies técnicas esenciales para la prestación del servicio solicitado por el usuario no requieren de su consentimiento explícito, aunque sí del deber de información que cumplimos mediante este texto.
        </p>

        <h3>4. Gestión de cookies</h3>
        <p>
          Puede usted permitir, bloquear o eliminar las cookies instaladas en su equipo mediante la configuración de las opciones del navegador instalado en su ordenador. Tenga en cuenta que si deshabilita las cookies técnicas, no podrá iniciar sesión ni utilizar la plataforma correctamente.
        </p>
      </div>
    </div>
  )
}

export default CookiesPolicy
