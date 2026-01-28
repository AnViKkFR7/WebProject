import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/Button'

const MyData = () => {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState(null)
  const [itemTypes, setItemTypes] = useState([])
  const [selectedItemType, setSelectedItemType] = useState(null)
  const [attributeDefinitions, setAttributeDefinitions] = useState([])
  const [editableFields, setEditableFields] = useState({})
  const [originalValues, setOriginalValues] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDefinitions, setNewDefinitions] = useState([{ label: '', data_type: 'text', is_filterable: false, is_required: false }])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [savingLabel, setSavingLabel] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (membership) {
        setCompanyId(membership.company_id)
        await loadItemTypes(membership.company_id)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const loadItemTypes = async (compId) => {
    try {
      const { data, error: err } = await supabase
        .from('attribute_definitions')
        .select('item_type')
        .eq('company_id', compId)

      if (err) throw err

      const uniqueTypes = [...new Set(data.map(d => d.item_type))]
      setItemTypes(uniqueTypes)
    } catch (err) {
      console.error('Error loading item types:', err)
      setError('Error al cargar los tipos de items')
    }
  }

  const loadAttributeDefinitions = async (itemType) => {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('attribute_definitions')
        .select('*')
        .eq('company_id', companyId)
        .eq('item_type', itemType)
        .order('created_at', { ascending: true })

      if (err) throw err

      setAttributeDefinitions(data || [])
      const original = {}
      data.forEach(def => {
        original[def.id] = def.label
      })
      setOriginalValues(original)
    } catch (err) {
      console.error('Error loading definitions:', err)
      setError('Error al cargar las definiciones de atributos')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectItemType = (itemType) => {
    setSelectedItemType(itemType)
    setEditableFields({})
    setError(null)
    setSuccess('')
    loadAttributeDefinitions(itemType)
  }

  const toggleEdit = (id) => {
    setEditableFields(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleDiscardLabel = (id) => {
    setAttributeDefinitions(prev =>
      prev.map(def => def.id === id ? { ...def, label: originalValues[id] } : def)
    )
    toggleEdit(id)
  }

  const handleSaveLabel = async (id) => {
    try {
      setSavingLabel(id)
      const def = attributeDefinitions.find(d => d.id === id)
      
      const { error: err } = await supabase
        .from('attribute_definitions')
        .update({ label: def.label })
        .eq('id', id)

      if (err) throw err

      setOriginalValues(prev => ({ ...prev, [id]: def.label }))
      toggleEdit(id)
      setSuccess('Label actualizado correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving label:', err)
      setError('Error al guardar el label')
    } finally {
      setSavingLabel(null)
    }
  }

  const handleLabelChange = (id, value) => {
    setAttributeDefinitions(prev =>
      prev.map(def => def.id === id ? { ...def, label: value } : def)
    )
  }

  const generateKey = (label) => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  const handleNewDefinitionChange = (index, field, value) => {
    const updated = [...newDefinitions]
    updated[index][field] = value
    setNewDefinitions(updated)

    // Si la fila actual tiene algún dato y es la última, añadir una nueva fila vacía
    const currentRow = updated[index]
    const hasData = currentRow.label || currentRow.data_type !== 'text' || currentRow.is_filterable || currentRow.is_required
    if (hasData && index === updated.length - 1) {
      setNewDefinitions([...updated, { label: '', data_type: 'text', is_filterable: false, is_required: false }])
    }
  }

  const handleRemoveRow = (index) => {
    if (newDefinitions.length > 1) {
      setNewDefinitions(newDefinitions.filter((_, i) => i !== index))
    }
  }

  const handleSaveNewDefinitions = async () => {
    try {
      setLoading(true)
      setError(null)

      // Filtrar solo las filas que tienen label
      const validDefinitions = newDefinitions.filter(def => def.label.trim() !== '')

      if (validDefinitions.length === 0) {
        setError('Debes añadir al menos un atributo con label')
        setLoading(false)
        return
      }

      // Preparar los datos para insertar
      const definitionsToInsert = validDefinitions.map(def => ({
        company_id: companyId,
        item_type: selectedItemType,
        key: generateKey(def.label),
        label: def.label,
        data_type: def.data_type,
        is_filterable: def.is_filterable,
        is_required: def.is_required
      }))

      const { error: err } = await supabase
        .from('attribute_definitions')
        .insert(definitionsToInsert)

      if (err) throw err

      setSuccess(`${validDefinitions.length} atributo(s) creado(s) correctamente`)
      setShowCreateModal(false)
      setNewDefinitions([{ label: '', data_type: 'text', is_filterable: false, is_required: false }])
      await loadAttributeDefinitions(selectedItemType)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error creating definitions:', err)
      setError(err.message || 'Error al crear los atributos')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !companyId) {
    return (
      <div className="page">
        <div className="page-content">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>Mis Datos</h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '800px' }}>
              Gestiona los tipos de items de tu empresa y sus propiedades. Desde aquí puedes editar las etiquetas de los atributos existentes 
              y crear nuevos atributos personalizados para cada tipo de item. Los atributos definen qué información puedes capturar para cada inmueble.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="alert success" style={{ marginBottom: '1.5rem' }}>
            {success}
          </div>
        )}

        {/* Lista de tipos de items */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Tipos de Items
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Selecciona un tipo de item para ver y gestionar sus atributos:
          </p>
          
          {itemTypes.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No hay tipos de items disponibles</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {itemTypes.map(type => (
                <div
                  key={type}
                  onClick={() => handleSelectItemType(type)}
                  style={{
                    padding: '1rem',
                    border: selectedItemType === type ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: selectedItemType === type ? 'var(--primary-light)' : 'var(--bg-card)',
                    fontWeight: selectedItemType === type ? 600 : 500,
                    color: selectedItemType === type ? 'var(--primary-color)' : 'var(--text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedItemType !== type) {
                      e.target.style.borderColor = 'var(--primary-color)'
                      e.target.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedItemType !== type) {
                      e.target.style.borderColor = 'var(--border-color)'
                      e.target.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  {type}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista de attribute definitions */}
        {selectedItemType && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                Atributos de {selectedItemType}
              </h3>
              <Button
                variant="primary"
                size="medium"
                onClick={() => setShowCreateModal(true)}
              >
                ➕ Crear Attribute Definition
              </Button>
            </div>

            {loading ? (
              <p>Cargando atributos...</p>
            ) : attributeDefinitions.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                No hay atributos definidos para este tipo de item
              </p>
            ) : (
              <div className="table">
                <div className="table-row table-header">
                  <span>Label</span>
                  <span>Key</span>
                  <span>Data Type</span>
                  <span>Filtrable</span>
                  <span>Requerido</span>
                  <span>Acciones</span>
                </div>
                {attributeDefinitions.map(def => (
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
        )}

        {/* Modal para crear nuevos attribute definitions */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Crear Attribute Definitions para {selectedItemType}</h3>
                <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Añade uno o más atributos a la tabla. Al empezar a llenar una fila, se creará automáticamente una nueva fila vacía debajo.
                </p>

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
              </div>

              <div className="modal-footer">
                <Button
                  variant="ghost"
                  size="medium"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewDefinitions([{ label: '', data_type: 'text', is_filterable: false, is_required: false }])
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={handleSaveNewDefinitions}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : '💾 Guardar Cambios'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyData
