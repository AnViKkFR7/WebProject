import { useLanguage } from '../../contexts/LanguageContext'

const ItemTypeSelector = ({ itemTypes, selectedItemType, onSelectItemType }) => {
  const { t } = useLanguage()
  
  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
        {t('myData.itemTypes')}
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{t('myData.selectItemType')}</p>
      
      {itemTypes.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{t('myData.noItemTypes')}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {itemTypes.map(type => (
            <div
              key={type}
              onClick={() => onSelectItemType(type)}
              style={{
                padding: '1.5rem',
                border: selectedItemType === type ? '2px solid var(--primary-color)' : '2px solid var(--border-color)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: selectedItemType === type ? 'var(--primary-color)' : 'var(--bg-card)',
                fontWeight: 600,
                fontSize: '1rem',
                color: selectedItemType === type ? 'white' : 'var(--text-primary)',
                textAlign: 'center',
                boxShadow: selectedItemType === type ? '0 8px 16px rgba(99, 102, 241, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (selectedItemType !== type) {
                  e.currentTarget.style.borderColor = 'var(--primary-color)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(99, 102, 241, 0.2)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedItemType !== type) {
                  e.currentTarget.style.borderColor = 'var(--border-color)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'
                }
              }}
            >
              {type}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ItemTypeSelector
