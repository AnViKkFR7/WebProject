import DatePicker from '../DatePicker'
import { displayLabel } from '../../lib/attributeLabel'
import { uiTypeOf } from '../../lib/attributeTypes'
import { useLanguage } from '../../contexts/LanguageContext'
import Icon from '../ui/Icon'

const AttributeItem = ({
  definition,
  attributeValue,
  isEditable,
  canEdit,
  onToggleEditable,
  onDiscard,
  onUpdate,
}) => {
  const { t } = useLanguage()
  const { value, edited } = attributeValue || { value: null, edited: false }

  const handleValueChange = (newValue) => {
    onUpdate(definition.id, newValue)
  }

  const renderInput = () => {
    switch (definition.data_type) {
      case 'boolean':
        return (
          <select
            className="input"
            value={value === null ? '' : value.toString()}
            onChange={(e) => handleValueChange(e.target.value === '' ? null : e.target.value === 'true')}
            disabled={!isEditable}
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        )

      case 'integer':
      case 'decimal':
        return (
          <input
            type="number"
            className="input"
            value={value ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null :
                         definition.data_type === 'integer' ? parseInt(e.target.value, 10) :
                         parseFloat(e.target.value)
              handleValueChange(val)
            }}
            disabled={!isEditable}
            required={definition.is_required}
            step={definition.data_type === 'decimal' ? '0.01' : '1'}
          />
        )

      case 'date':
        return (
          <DatePicker
            label={displayLabel(definition.label)}
            value={value || ''}
            onChange={(dateString) => handleValueChange(dateString || null)}
            disabled={!isEditable}
            required={definition.is_required}
          />
        )

      case 'text_array':
        return (
          <div>
            {Array.isArray(value) && value.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: '0.75rem'
              }}>
                {value.map((item, index) => (
                  <div key={index} className="array-item">
                    <span className="array-index">{index + 1}.</span>
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>{item}</span>
                    {isEditable && (
                      <button
                        onClick={() => {
                          const newArray = value.filter((_, i) => i !== index)
                          handleValueChange(newArray.length > 0 ? newArray : null)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger-color)',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          padding: '0.25rem'
                        }}
                        title="Eliminar"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isEditable && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Nuevo elemento..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const inputValue = e.target.value.trim()
                      if (inputValue) {
                        const currentArray = Array.isArray(value) ? value : []
                        handleValueChange([...currentArray, inputValue])
                        e.target.value = ''
                      }
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={(e) => {
                    const input = e.target.parentElement.querySelector('input')
                    const inputValue = input.value.trim()
                    if (inputValue) {
                      const currentArray = Array.isArray(value) ? value : []
                      handleValueChange([...currentArray, inputValue])
                      input.value = ''
                    }
                  }}
                  style={{
                    padding: '0.625rem 1rem',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem'
                  }}
                >
                  + Agregar
                </button>
              </div>
            )}
            {!isEditable && (!Array.isArray(value) || value.length === 0) && (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Sin elementos
              </div>
            )}
          </div>
        )

      case 'number_array':
        return (
          <div>
            {Array.isArray(value) && value.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: '0.75rem'
              }}>
                {value.map((item, index) => (
                  <div key={index} className="array-item">
                    <span className="array-index">{index + 1}.</span>
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>{item}</span>
                    {isEditable && (
                      <button
                        onClick={() => {
                          const newArray = value.filter((_, i) => i !== index)
                          handleValueChange(newArray.length > 0 ? newArray : null)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger-color)',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          padding: '0.25rem'
                        }}
                        title="Eliminar"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isEditable && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  className="input"
                  placeholder="Nuevo número..."
                  step="any"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const inputValue = e.target.value.trim()
                      if (inputValue) {
                        const currentArray = Array.isArray(value) ? value : []
                        handleValueChange([...currentArray, parseFloat(inputValue)])
                        e.target.value = ''
                      }
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={(e) => {
                    const input = e.target.parentElement.querySelector('input')
                    const inputValue = input.value.trim()
                    if (inputValue) {
                      const currentArray = Array.isArray(value) ? value : []
                      handleValueChange([...currentArray, parseFloat(inputValue)])
                      input.value = ''
                    }
                  }}
                  style={{
                    padding: '0.625rem 1rem',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem'
                  }}
                >
                  + Agregar
                </button>
              </div>
            )}
            {!isEditable && (!Array.isArray(value) || value.length === 0) && (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Sin elementos
              </div>
            )}
          </div>
        )

      default: // text, longtext
        if (definition.validation_rules?.options) {
          return (
            <select
              className="input"
              value={value || ''}
              onChange={(e) => handleValueChange(e.target.value || null)}
              disabled={!isEditable}
              required={definition.is_required}
            >
              <option value="">Selecciona una opción</option>
              {definition.validation_rules.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )
        } else if (definition.data_type === 'longtext') {
          return (
            <textarea
              className="input"
              value={value || ''}
              onChange={(e) => handleValueChange(e.target.value || null)}
              disabled={!isEditable}
              required={definition.is_required}
              rows={4}
              style={{ resize: 'vertical' }}
            />
          )
        } else {
          return (
            <input
              type="text"
              className="input"
              value={value || ''}
              onChange={(e) => handleValueChange(e.target.value || null)}
              disabled={!isEditable}
              required={definition.is_required}
            />
          )
        }
    }
  }

  return (
    <div className="attr-item-card" style={{
      padding: '1rem',
      backgroundColor: 'var(--bg-hover)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      marginBottom: '1.5rem'
    }}>
      {/* Attribute Header */}
      <div className="attr-item-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div className="attr-item-info" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <label style={{ fontWeight: 600, fontSize: '1rem' }}>
              {displayLabel(definition.label)}
              {definition.is_required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
          </div>
          {definition.description && (
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginTop: '0.25rem',
              marginBottom: '0.5rem'
            }}>
              {definition.description}
            </p>
          )}
          <div className="attr-item-meta" style={{
            fontSize: '0.75rem',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <span style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary-color)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 500
            }}>{t('attributes.key')}: {definition.key}</span>
            <span style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary-color)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 500
            }}>{t(`attributes.types.${uiTypeOf(definition)}`)}</span>
          </div>
        </div>

      </div>

      <div className="attr-item-input-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {renderInput()}
        </div>

        {/* Edit/Lock button and Discard button - outside input */}
        {canEdit && (
          <div style={{
            display: 'flex',
            gap: '5px',
            alignItems: 'center'
          }}>
            {/* Discard button - only show when field is edited */}
            {edited && isEditable && (
              <button
                onClick={() => onDiscard(definition.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--danger-color)'
                }}
                title="Descartar cambios"
              >
                <Icon name="reset" size={18} />
              </button>
            )}

            {/* Edit/Lock toggle button */}
            <button
              onClick={() => onToggleEditable(`attr-${definition.id}`)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.1rem',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                color: isEditable ? 'var(--primary-color)' : 'var(--text-secondary)'
              }}
              title={isEditable ? 'Bloquear campo' : 'Editar campo'}
            >
              <Icon name="edit" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AttributeItem
