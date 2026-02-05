import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Button from '../Button'
import { useLanguage } from '../../contexts/LanguageContext'

const ItemDetailHeader = ({ item, loading }) => {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [copySuccess, setCopySuccess] = useState(false)

  const handleShareClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ 
            height: '32px', 
            width: '200px', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '4px',
            marginBottom: '0.5rem'
          }}></div>
          <div style={{ 
            height: '20px', 
            width: '150px', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '4px'
          }}></div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <h1 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          marginBottom: '0.5rem',
          color: 'var(--text-color)'
        }}>
          {item?.title || t('itemDetail.loading')}
        </h1>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {copySuccess && (
          <span style={{ 
            fontSize: '0.875rem', 
            color: 'var(--success-color)',
            fontWeight: 500
          }}>
            ✓ {t('common.urlCopied')}
          </span>
        )}
        <Button 
          onClick={handleShareClick}
          variant="ghost"
          size="small"
        >
          🔗 {t('common.share')}
        </Button>
        <Button 
          onClick={() => navigate('/items')}
          variant="ghost"
          size="small"
        >
          {t('itemDetail.back')}
        </Button>
      </div>
    </div>
  )
}

export default ItemDetailHeader
