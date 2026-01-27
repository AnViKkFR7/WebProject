import { useNavigate } from 'react-router-dom'
import Button from '../Button'

const ItemDetailHeader = ({ item, loading }) => {
  const navigate = useNavigate()

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
          {item?.title || 'Cargando...'}
        </h1>
      </div>
      <Button 
        onClick={() => navigate('/items')}
        variant="ghost"
        size="small"
      >
        ← Volver
      </Button>
    </div>
  )
}

export default ItemDetailHeader
