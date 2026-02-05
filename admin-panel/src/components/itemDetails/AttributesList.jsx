import AttributeItem from './AttributeItem'
import { useLanguage } from '../../contexts/LanguageContext'

const AttributesList = ({ 
  attributeDefinitions,
  attributeValues,
  editableFields,
  canEdit,
  searchFilter,
  onToggleEditable,
  onDiscard,
  onUpdate,
  onUpdateDefinition,
  onSearchChange,
  loading
}) => {
  const { t } = useLanguage()

  const getFilteredAndSortedDefinitions = () => {
    let filtered = attributeDefinitions

    // Filter by search term
    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase()
      filtered = filtered.filter(def => 
        def.label.toLowerCase().includes(search) ||
        (def.description && def.description.toLowerCase().includes(search))
      )
    }

    return filtered
  }

  if (loading) {
    return (
      <div className="section-card">
        <h2 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          marginBottom: '1rem',
          color: 'var(--text-color)'
        }}>
          {t('itemDetail.propertyAttributes')}
        </h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i}>
              <div style={{ 
                height: '20px', 
                width: '120px', 
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

  const filteredDefinitions = getFilteredAndSortedDefinitions()

  return (
    <div className="section-card" style={{ paddingBottom: '6rem' }}>
      <h2 style={{ 
        fontSize: '1.125rem', 
        fontWeight: '600', 
        marginBottom: '1rem',
        color: 'var(--text-color)'
      }}>
        {t('itemDetail.propertyAttributes')}
      </h2>

      {/* Search Filter */}
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
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
          placeholder={t('itemDetail.filterPlaceholder')}
          value={searchFilter}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: '100%', paddingLeft: '2.5rem' }}
        />
      </div>

      {/* Attributes List */}
      <div style={{ 
        display: 'flex',
        flexDirection: 'column'
      }}>
        {filteredDefinitions.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            color: 'var(--text-secondary)' 
          }}>
            {t('itemDetail.noAttributesFound')} "{searchFilter}"
          </div>
        ) : (
          filteredDefinitions.map((def) => (
            <AttributeItem
              key={def.id}
              definition={def}
              attributeValue={attributeValues[def.id]}
              isEditable={editableFields[`attr-${def.id}`] || false}
              canEdit={canEdit}
              onToggleEditable={onToggleEditable}
              onDiscard={onDiscard}
              onUpdate={onUpdate}
              onUpdateDefinition={onUpdateDefinition}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default AttributesList
