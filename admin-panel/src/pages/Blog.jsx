import { useLanguage } from '../contexts/LanguageContext'

const Blog = () => {
  const { t } = useLanguage()
  
  return (
    <div className="page">
      <div className="page-content">
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: '4rem 2rem',
          maxWidth: '600px',
          margin: '2rem auto'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚧</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {t('blog.title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            {t('blog.comingSoon')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Blog
