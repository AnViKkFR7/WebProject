import Button from '../Button'
import { useLanguage } from '../../contexts/LanguageContext'

const ItemDetailFooter = ({ 
  changedFieldsCount, 
  saving, 
  onCancel, 
  onSave 
}) => {
  const { t } = useLanguage()

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '250px', // Sidebar width
      right: 0,
      backgroundColor: 'var(--bg-primary)',
      borderTop: '2px solid var(--border-color)',
      padding: '1rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 100,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
    }}
    className="item-detail-footer"
    >
      <div style={{ 
        fontSize: '0.875rem',
        color: changedFieldsCount > 0 ? 'var(--primary-color)' : 'var(--text-secondary)',
        fontWeight: '500'
      }}>
        {changedFieldsCount > 0 ? `${changedFieldsCount} ${t('itemDetail.fieldsModified')}` : t('itemDetail.noChanges')}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Button
          onClick={onCancel}
          variant="ghost"
          disabled={saving}
        >
          {t('itemDetail.cancel')}
        </Button>
        <Button
          onClick={onSave}
          variant="primary"
          disabled={saving || changedFieldsCount === 0}
        >
          {saving ? t('itemDetail.saving') : t('itemDetail.saveChanges')}
        </Button>
      </div>
    </div>
  )
}

export default ItemDetailFooter
