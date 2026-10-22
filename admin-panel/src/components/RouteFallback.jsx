import { useLanguage } from '../contexts/LanguageContext'

/**
 * Se ve mientras se descarga el código de una página (ver App.jsx).
 * Es una barra fina arriba en vez de un bloque de "Cargando…": en una conexión
 * normal esto dura unas décimas y un texto grande parpadeando molesta más.
 */
const RouteFallback = () => {
  const { t } = useLanguage()
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback-bar" aria-hidden="true" />
      <span className="visually-hidden">{t('common.loading')}</span>
    </div>
  )
}

export default RouteFallback
