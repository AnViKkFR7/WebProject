const AttributeDefinitionsForm = ({ 
  newDefinitions, 
  handleNewDefinitionChange, 
  handleRemoveRow 
}) => {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        border: '1px solid var(--border-color)',
        borderRadius: '8px'
      }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-table-header)', borderBottom: '2px solid var(--border-color)' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>Label *</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>Data Type *</th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem' }}>Filtrable</th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem' }}>Requerido</th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem', width: '60px' }}></th>
          </tr>
        </thead>
        <tbody>
          {newDefinitions.map((def, index) => (
            <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.5rem' }}>
                <input
                  type="text"
                  className="input"
                  value={def.label}
                  onChange={(e) => handleNewDefinitionChange(index, 'label', e.target.value)}
                  placeholder="Ej: Número de habitaciones"
                  style={{ width: '100%' }}
                />
              </td>
              <td style={{ padding: '0.5rem' }}>
                <select
                  className="select"
                  value={def.data_type}
                  onChange={(e) => handleNewDefinitionChange(index, 'data_type', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="text">text</option>
                  <option value="longtext">longtext</option>
                  <option value="integer">integer</option>
                  <option value="decimal">decimal</option>
                  <option value="boolean">boolean</option>
                  <option value="date">date</option>
                  <option value="text_array">text_array</option>
                  <option value="number_array">number_array</option>
                </select>
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={def.is_filterable}
                  onChange={(e) => handleNewDefinitionChange(index, 'is_filterable', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={def.is_required}
                  onChange={(e) => handleNewDefinitionChange(index, 'is_required', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                <button
                  onClick={() => handleRemoveRow(index)}
                  disabled={newDefinitions.length === 1}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: newDefinitions.length === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '1.2rem',
                    opacity: newDefinitions.length === 1 ? 0.3 : 1,
                    color: 'var(--text-secondary)'
                  }}
                  title="Eliminar fila"
                >
                  ❌
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AttributeDefinitionsForm
