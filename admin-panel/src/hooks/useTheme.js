import { useCallback, useEffect, useState } from 'react'

const readTheme = () => {
  try {
    return localStorage.getItem('theme') || 'light'
  } catch {
    return 'light'
  }
}

/** Tema claro/oscuro. Único dueño del estado (antes lo duplicaban Sidebar y Topbar). */
export function useTheme() {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // Almacenamiento bloqueado: el tema dura la sesión
    }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')), [])
  return { theme, toggleTheme }
}
