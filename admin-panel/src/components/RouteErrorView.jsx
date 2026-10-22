import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

export default function RouteErrorView() {
  const { t } = useLanguage()
  return <section className="page-content card" role="alert">
    <h1>{t('routeError.title')}</h1><p>{t('routeError.description')}</p>
    <button className="primary-button" onClick={() => window.location.reload()}>{t('invoicing.retry')}</button>
    <Link className="ghost-button" to="/">{t('routeError.home')}</Link>
  </section>
}
