import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const PrivacyPolicy = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', marginBottom: '1rem', fontSize: '1rem' }}>
             ← {t('common.back') || 'Volver'}
          </button>
          <h2>Política de Privacidad</h2>
        </div>
      </section>

      <div className="card" style={{ padding: '2rem', maxWidth: '800px' }}>
        <h3>1. Responsable del Tratamiento</h3>
        <p>
          El responsable del tratamiento de los datos personales recogidos en esta plataforma es <strong>Moira Ordo</strong>, 
          con domicilio en <strong>Vilanova i la Geltrú</strong> y NIF/CIF <strong>[XXXXXX]</strong>. 
          Puede contactar con el responsable a través del correo electrónico: <strong>gasa.aaron@gmail.com</strong>.
        </p>

        <h3>2. Datos Recopilados y Origen</h3>
        <p>
          Para el correcto funcionamiento del servicio, recopilamos los siguientes datos de carácter personal:
        </p>
        <ul>
          <li><strong>Datos identificativos:</strong> Nombre completo, correo electrónico y número de teléfono.</li>
          <li><strong>Datos de conexión:</strong> Dirección IP, logs de acceso y cookies técnicas para el mantenimiento de la sesión.</li>
        </ul>
        <p>
          <strong>Origen de los datos:</strong> Al tratarse de una plataforma privada por invitación, sus datos personales (email y nombre) han sido facilitados inicialmente por su organización o empresa empleadora para autorizarle el acceso a la herramienta.
        </p>

        <h3>3. Finalidad del Tratamiento</h3>
        <p>
          Sus datos serán tratados con las siguientes finalidades:
        </p>
        <ul>
          <li>Gestionar el acceso seguro y la autenticación en la plataforma.</li>
          <li>Administrar permisos y roles dentro de la organización a la que pertenece.</li>
          <li>Garantizar la seguridad de la infraestructura y trazabilidad de las acciones (logs de auditoría).</li>
        </ul>

        <h3>4. Conservación de los Datos</h3>
        <p>
          Sus datos personales se conservarán mientras mantenga su condición de usuario autorizado en la plataforma y exista una relación contractual con su organización. Una vez finalizada dicha relación, los datos serán bloqueados durante los plazos legales exigidos antes de su eliminación definitiva.
        </p>

        <h3>5. Legitimación</h3>
        <p>
          La base legal para el tratamiento de sus datos es:
        </p>
        <ul>
          <li><strong>Ejecución de contrato:</strong> Su vinculación como usuario autorizado para prestar servicios a su organización.</li>
          <li><strong>Interés legítimo:</strong> Del responsable en garantizar la seguridad del sistema y prevenir accesos no autorizados.</li>
        </ul>

        <h3>6. Destinatarios y Transferencias Internacionales</h3>
        <p>
          Sus datos no se cederán a terceros, salvo obligación legal. Para la infraestructura técnica utilizamos proveedores de confianza (Encargados de Tratamiento) como:
        </p>
        <ul>
          <li><strong>Supabase:</strong> (Base de datos y autenticación).</li>
          <li><strong>Vercel:</strong> (Alojamiento web).</li>
        </ul>
        <p>
          Algunos de estos proveedores pueden procesar datos fuera del Espacio Económico Europeo. En estos casos, nos aseguramos de que ofrezcan garantías adecuadas de protección de datos, como la adhesión a marcos de privacidad reconocidos o la firma de Cláusulas Contractuales Tipo (SCC).
        </p>

        <h3>7. Derechos del Usuario</h3>
        <p>
          Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad enviando un correo electrónico a <strong>[EMAIL DE CONTACTO]</strong>. Si considera que sus derechos no han sido respetados, puede presentar una reclamación ante la autoridad de control competente (ej. AEPD en España).
        </p>
      </div>
    </div>
  )
}

export default PrivacyPolicy
