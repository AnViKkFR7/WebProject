import { useLanguage } from '../../contexts/LanguageContext'

const ItemBasicInfo = ({ 
  itemData, 
  setItemData, 
  canEdit, 
  loading,
  editableFields,
  onToggleEditable
}) => {
  const { t } = useLanguage()

  const STATUS_OPTIONS = [
    { value: 'draft', label: t('items.draft') },
    { value: 'published', label: t('items.published') },
    { value: 'archived', label: t('items.archived') }
  ]
  if (loading) {
    return (
      <div className="section-card">
        <h2 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          marginBottom: '1rem',
          color: 'var(--text-color)'
        }}>
          {t('itemDetail.basicInfo')}
        </h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div style={{ 
                height: '20px', 
                width: '100px', 
                backgroundColor: 'var(--bg-secondary)', 
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}></div>
              <div style={{ 
                height: '40px', 
                width: '100%', 
                backgroundColor: 'var(--bg-secondary)', 
                borderRadius: '4px'
              }}></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="section-card">
      <h2 style={{ 
        fontSize: '1.125rem', 
        fontWeight: '600', 
        marginBottom: '1rem',
        color: 'var(--text-color)'
      }}>
        {t('itemDetail.basicInfo')}
      </h2>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Clave */}
        <div>
          <label 
            htmlFor="item-key" 
            className="label"
          >
            {t('itemDetail.propertyTitle')}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="item-key"
              type="text"
              className="input"
              value={itemData.title}
              onChange={(e) => setItemData({...itemData, title: e.target.value})}
              disabled={!editableFields?.['basic-title']}
              placeholder={t('itemDetail.titlePlaceholder')}
              style={{ paddingRight: '50px' }}
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => onToggleEditable('basic-title')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: editableFields?.['basic-title'] ? 'var(--primary-color)' : 'var(--text-secondary)'
                }}
                title={editableFields?.['basic-title'] ? t('itemDetail.lockField') : t('itemDetail.editField')}
              >
                ✏️
              </button>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div>
          <label htmlFor="item-summary" className="label">
            {t('itemDetail.summary')}
          </label>
          <div style={{ position: 'relative' }}>
            <textarea
              id="item-summary"
              className="input"
              value={itemData.summary || ''}
              onChange={(e) => setItemData({...itemData, summary: e.target.value})}
              disabled={!editableFields?.['basic-summary']}
              placeholder={t('itemDetail.summaryPlaceholder')}
              rows={3}
              style={{ 
                resize: 'vertical',
                paddingRight: '50px'
              }}
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => onToggleEditable('basic-summary')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: editableFields?.['basic-summary'] ? 'var(--primary-color)' : 'var(--text-secondary)'
                }}
                title={editableFields?.['basic-summary'] ? t('itemDetail.lockField') : t('itemDetail.editField')}
              >
                ✏️
              </button>
            )}
          </div>
        </div>

        {/* Estado */}
        <div>
          <label htmlFor="item-status" className="label">
            {t('itemDetail.status')}
          </label>
          <div style={{ position: 'relative' }}>
            <select
              id="item-status"
              className="input"
              value={itemData.status}
              onChange={(e) => setItemData({...itemData, status: e.target.value})}
              disabled={!editableFields?.['basic-status']}
              style={{ paddingRight: '50px' }}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {canEdit && (
              <button
                type="button"
                onClick={() => onToggleEditable('basic-status')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: editableFields?.['basic-status'] ? 'var(--primary-color)' : 'var(--text-secondary)'
                }}
                title={editableFields?.['basic-status'] ? t('itemDetail.lockField') : t('itemDetail.editField')}
              >
                ✏️
              </button>
            )}
          </div>
        </div>

        {/* Tipo */}
        <div>
          <label 
            htmlFor="item-type"
            className="label"
          >
            {t('itemDetail.type')}
          </label>
          <input
            id="item-type"
            type="text"
            className="input"
            value={itemData.item_type}
            disabled
            style={{ 
              backgroundColor: 'var(--bg-secondary)',
              cursor: 'not-allowed'
            }}
          />      
        </div>
      </div>
    </div>
  )
}

export default ItemBasicInfo
