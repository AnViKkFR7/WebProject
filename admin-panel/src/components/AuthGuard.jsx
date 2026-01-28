import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { authService } from '../services/authService'
import { supabase } from '../lib/supabaseClient'

const AuthGuard = () => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // 1. Check active session on mount
    authService.getSession().then((currentSession) => {
      setSession(currentSession)
      setLoading(false)
    }).catch(() => {
        setSession(null)
        setLoading(false)
    })

    // 2. Listen for auth changes (e.g. login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        <h2>Error de Configuración</h2>
        <p>No se ha podido inicializar el cliente de Supabase.</p>
        <p>Asegúrate de tener el archivo <code>.env</code> configurado con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.</p>
      </div>
    )
  }

  if (loading) {
    // You can replace this with a proper loading spinner component
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default AuthGuard
