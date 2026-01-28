import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'

const Login = () => {
  const [view, setView] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('') // Mensajes de éxito
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      await authService.login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      await authService.resetPasswordForEmail(email)
      setMessage('Te hemos enviado un enlace a tu correo para restablecer la contraseña.')
      // Opcional: volver al login tras unos segundos
    } catch (err) {
      setError(err.message || 'Error al solicitar recuperación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-placeholder">🌐</div>
          <h2>{view === 'login' ? 'Bienvenido de nuevo' : 'Recuperar Cuenta'}</h2>
          <p>
            {view === 'login' 
              ? 'Ingresa tus credenciales para administrar el sistema' 
              : 'Ingresa tu email y te enviaremos instrucciones'}
          </p>
        </div>
        
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        
        {view === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nombre@ejemplo.com"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              <div className="forgot-link-wrapper">
                <button 
                  type="button" 
                  className="link-button" 
                  onClick={() => setView('forgot')}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            <button type="submit" className="primary-button full-width" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="login-form">
            <div className="form-group">
              <label htmlFor="reset-email">Email</label>
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nombre@ejemplo.com"
              />
            </div>

            <button type="submit" className="primary-button full-width" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
            
            <div className="back-to-login">
              <button 
                type="button" 
                className="back-to-login-button full-width"
                onClick={() => {
                  setView('login')
                  setError('')
                  setMessage('')
                }}
              >
                Volver al inicio de sesión
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login
