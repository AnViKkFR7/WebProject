import Button from '../Button'
import { useLanguage } from '../../contexts/LanguageContext'

const AttributeDefinitionsTable = ({
  selectedItemType,
  loading,
  attributeDefinitions,
  searchQuery,
  setSearchQuery,
  editableFields,
  handleLabelChange,
  toggleEdit,
  handleSaveLabel,
  handleDiscardLabel,
  savingLabel,
  onCreateNew
}) => {
  const { t } = useLanguage()
  
  if (!selectedItemType) return null

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
          {t('myData.attributes')} {selectedItemType}
        </h3>
        <Button
          variant="primary"
          size="medium"
          onClick={onCreateNew}
        >
         {t('myData.createAttributeDefinition')}
        </Button>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <span style={{ 
          position: 'absolute', 
          left: '12px', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          fontSize: '1rem', 
          color: 'var(--text-tertiary)',
          pointerEvents: 'none',
          zIndex: 9
        }}>
          🔍
        </span>
        <input
          type="text"
          className="input"
          placeholder={t('myData.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '2.5rem',
            paddingRight: searchQuery ? '2.5rem' : '0.875rem',
            fontSize: '0.9375rem'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: 'var(--text-secondary)',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {loading ? (
        <p>{t('myData.loadingAttributes')}</p>
      ) : attributeDefinitions.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          {t('myData.noAttributes')}
        </p>
      ) : (
        <div className="table">
          <div className="table-row table-header">
            <span>{t('myData.label')}</span>
            <span>{t('myData.key')}</span>
            <span>{t('myData.dataType')}</span>
            <span>{t('myData.filterable')}</span>
            <span>{t('myData.required')}</span>
            <span></span>
          </div>
          {attributeDefinitions
            .filter(def => 
              def.label.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(def => (
            <div key={def.id} className="table-row">
              <span className="row-title">
                {editableFields[def.id] ? (
                  <input
                    type="text"
                    className="input"
                    value={def.label}
                    onChange={(e) => handleLabelChange(def.id, e.target.value)}
                    style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                    autoFocus
                  />
                ) : (
                  def.label
                )}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {def.key}
              </span>
              <span>
                <span className="pill" style={{ background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                  {def.data_type}
                </span>
              </span>
              <span>
                {def.is_filterable ? '✅' : '❌'}
              </span>
              <span>
                {def.is_required ? '✅' : '❌'}
              </span>
              <span>
                {editableFields[def.id] ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="button button-primary button-small"
                      onClick={() => handleSaveLabel(def.id)}
                      disabled={savingLabel === def.id}
                    >
                      {savingLabel === def.id ? '...' : '💾'}
                    </button>
                    <button
                      className="button button-ghost button-small"
                      onClick={() => handleDiscardLabel(def.id)}
                    >
                      ❌
                    </button>
                  </div>
                ) : (
                  <button
                    className="button button-ghost button-small"
                    onClick={() => toggleEdit(def.id)}
                  >
                    ✏️
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AttributeDefinitionsTable
