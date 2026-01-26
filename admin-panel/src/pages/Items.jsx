import { useState, useEffect } from 'react'
import { itemService } from '../services/itemService'
import { attributeDefinitionService } from '../services/attributeDefinitionService'
import { userPreferencesService } from '../services/userPreferencesService'
import { supabase } from '../lib/supabaseClient'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Archivado' }
]

const Items = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  // User and company
  const [userId, setUserId] = useState(null)
  const [companyId, setCompanyId] = useState(null)

  // Fixed filters
  const [statusFilter, setStatusFilter] = useState([])
  const [itemTypeFilter, setItemTypeFilter] = useState([])
  const [sortByDate, setSortByDate] = useState(null) // 'asc' | 'desc' | null

  // Item types available
  const [itemTypes, setItemTypes] = useState([])

  // Advanced filters
  const [showAdvancedFilterModal, setShowAdvancedFilterModal] = useState(false)
  const [attributeDefinitions, setAttributeDefinitions] = useState([])
  const [selectedAdvancedFilters, setSelectedAdvancedFilters] = useState([]) // Array of definition IDs
  const [advancedFilterValues, setAdvancedFilterValues] = useState({}) // { definitionId: [selectedValues] }

  // Create item modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newItem, setNewItem] = useState({
    title: '',
    summary: '',
    status: 'draft',
    item_type: ''
  })
  const [newItemAttributes, setNewItemAttributes] = useState({})

  // Load user and company
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        
        // Get user's company
        const { data: membership } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()
        
        if (membership) {
          setCompanyId(membership.company_id)
        }
      }
    }
    loadUser()
  }, [])

  // Load attribute definitions and item types
  useEffect(() => {
    if (!companyId) return

    const loadMetadata = async () => {
      try {
        const [definitions, types] = await Promise.all([
          attributeDefinitionService.getDefinitions(companyId),
          attributeDefinitionService.getUniqueItemTypes(companyId)
        ])
        setAttributeDefinitions(definitions)
        setItemTypes(types)
      } catch (err) {
        console.error('Error loading metadata:', err)
      }
    }

    loadMetadata()
  }, [companyId])

  // Load user preferences
  useEffect(() => {
    if (!userId) return

    const loadPreferences = async () => {
      try {
        const prefs = await userPreferencesService.getFilterPreferences(userId, 'items')
        if (prefs && prefs.filter_config) {
          setSelectedAdvancedFilters(prefs.filter_config.advanced_filters || [])
        }
      } catch (err) {
        console.error('Error loading preferences:', err)
      }
    }

    loadPreferences()
  }, [userId])

  // Load items
  useEffect(() => {
    if (!companyId) return

    const loadItems = async () => {
      setLoading(true)
      setError(null)
      try {
        const filters = {
          status: statusFilter,
          item_type: itemTypeFilter,
          sort_by_date: sortByDate
        }

        const result = await itemService.getItemsByAdvancedFilters(
          companyId,
          filters,
          advancedFilterValues,
          page,
          pageSize
        )

        setItems(result.data)
        setTotalCount(result.count)
        setTotalPages(result.totalPages)
      } catch (err) {
        console.error('Error loading items:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadItems()
  }, [companyId, statusFilter, itemTypeFilter, sortByDate, advancedFilterValues, page])

  // Save advanced filter preferences
  const saveFilterPreferences = async (filterIds) => {
    if (!userId) return
    
    try {
      await userPreferencesService.saveFilterPreferences(userId, 'items', {
        advanced_filters: filterIds
      })
    } catch (err) {
      console.error('Error saving preferences:', err)
    }
  }

  // Toggle advanced filter selection
  const toggleAdvancedFilter = (definitionId) => {
    const newSelection = selectedAdvancedFilters.includes(definitionId)
      ? selectedAdvancedFilters.filter(id => id !== definitionId)
      : [...selectedAdvancedFilters, definitionId]
    
    setSelectedAdvancedFilters(newSelection)
  }

  // Apply advanced filter selection
  const applyAdvancedFilterSelection = () => {
    saveFilterPreferences(selectedAdvancedFilters)
    setShowAdvancedFilterModal(false)
  }

  // Get unique values for a specific attribute definition
  const getUniqueValuesForAttribute = (definitionId) => {
    const definition = attributeDefinitions.find(d => d.id === definitionId)
    if (!definition) return []

    const values = new Set()
    items.forEach(item => {
      if (!item.attribute_values) return
      
      const attrValue = item.attribute_values.find(av => av.attribute_id === definitionId)
      if (attrValue) {
        let value
        switch (definition.data_type) {
          case 'text':
            value = attrValue.value_text
            break
          case 'number':
            value = attrValue.value_number
            break
          case 'boolean':
            value = attrValue.value_boolean
            break
          case 'date':
            value = attrValue.value_date
            break
          case 'text_array':
            if (Array.isArray(attrValue.value_text_array)) {
              attrValue.value_text_array.forEach(v => values.add(v))
            }
            return
          case 'number_array':
            if (Array.isArray(attrValue.value_number_array)) {
              attrValue.value_number_array.forEach(v => values.add(v))
            }
            return
          default:
            value = attrValue.value_text
        }
        if (value !== null && value !== undefined) {
          values.add(String(value))
        }
      }
    })
    
    return Array.from(values).sort()
  }

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter([])
    setItemTypeFilter([])
    setSortByDate(null)
    setAdvancedFilterValues({})
    setPage(1)
  }

  // Create item
  const handleCreateItem = async (e) => {
    e.preventDefault()
    
    if (!companyId) {
      alert('No se ha encontrado la compañía')
      return
    }

    try {
      const itemData = {
        ...newItem,
        company_id: companyId
      }

      const createdItem = await itemService.createItem(itemData)

      // Create attribute values
      for (const [defId, value] of Object.entries(newItemAttributes)) {
        if (!value) continue

        const definition = attributeDefinitions.find(d => d.id === defId)
        if (!definition) continue

        const valueData = {
          item_id: createdItem.id,
          attribute_id: defId
        }

        switch (definition.data_type) {
          case 'text':
            valueData.value_text = value
            break
          case 'number':
            valueData.value_number = parseFloat(value)
            break
          case 'boolean':
            valueData.value_boolean = value === 'true' || value === true
            break
          case 'date':
            valueData.value_date = value
            break
          case 'text_array':
            valueData.value_text_array = Array.isArray(value) ? value : [value]
            break
          case 'number_array':
            valueData.value_number_array = Array.isArray(value) 
              ? value.map(v => parseFloat(v)) 
              : [parseFloat(value)]
            break
          default:
            valueData.value_text = value
        }

        await itemService.upsertAttributeValue(valueData)
      }

      // Reset form
      setNewItem({
        title: '',
        summary: '',
        status: 'draft',
        item_type: ''
      })
      setNewItemAttributes({})
      setShowCreateModal(false)

      // Reload items
      setPage(1)
    } catch (err) {
      console.error('Error creating item:', err)
      alert('Error al crear el item: ' + err.message)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `Hace ${diffMins}m`
    if (diffHours < 24) return `Hace ${diffHours}h`
    if (diffDays < 7) return `Hace ${diffDays}d`
    
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Items</h2>
          <p>Gestiona los elementos genéricos por empresa y tipo.</p>
        </div>
        <div className="header-actions">
          <button 
            className="primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            Nuevo item
          </button>
        </div>
      </section>

      <div className="card">
        {/* Filters toolbar */}
        <div className="toolbar" style={{ flexDirection: 'column', gap: '1rem' }}>
          {/* Fixed filters */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            flexWrap: 'wrap', 
            alignItems: 'center',
            width: '100%'
          }}>
            {/* Status filter */}
            <div style={{ minWidth: '200px', flex: 1 }}>
              <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>
                Estado
              </label>
              <select 
                className="select"
                multiple
                size={1}
                value={statusFilter}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value)
                  setStatusFilter(selected)
                  setPage(1)
                }}
                style={{ minHeight: '38px' }}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Item type filter */}
            <div style={{ minWidth: '200px', flex: 1 }}>
              <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>
                Tipo de ítem
              </label>
              <select 
                className="select"
                multiple
                size={1}
                value={itemTypeFilter}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value)
                  setItemTypeFilter(selected)
                  setPage(1)
                }}
                style={{ minHeight: '38px' }}
              >
                {itemTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Sort by date */}
            <div style={{ minWidth: '200px', flex: 1 }}>
              <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>
                Ordenar por fecha
              </label>
              <select 
                className="select"
                value={sortByDate || ''}
                onChange={(e) => {
                  setSortByDate(e.target.value || null)
                  setPage(1)
                }}
              >
                <option value="">Más recientes primero</option>
                <option value="asc">Más antiguos primero</option>
                <option value="desc">Más recientes primero</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <button 
                className="ghost-button small"
                onClick={() => setShowAdvancedFilterModal(true)}
              >
                Filtros avanzados ({selectedAdvancedFilters.length})
              </button>
              <button 
                className="ghost-button small"
                onClick={clearAllFilters}
              >
                Borrar filtros
              </button>
            </div>
          </div>

          {/* Advanced filters */}
          {selectedAdvancedFilters.length > 0 && (
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              flexWrap: 'wrap',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              width: '100%'
            }}>
              {selectedAdvancedFilters.map(defId => {
                const definition = attributeDefinitions.find(d => d.id === defId)
                if (!definition) return null

                const availableValues = getUniqueValuesForAttribute(defId)

                return (
                  <div key={defId} style={{ minWidth: '200px', flex: 1 }}>
                    <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>
                      {definition.label}
                    </label>
                    <select 
                      className="select"
                      multiple
                      size={1}
                      value={advancedFilterValues[defId] || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value)
                        setAdvancedFilterValues(prev => ({
                          ...prev,
                          [defId]: selected
                        }))
                        setPage(1)
                      }}
                      style={{ minHeight: '38px' }}
                    >
                      {availableValues.map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            Cargando items...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--error-bg)', 
            color: 'var(--error-color)',
            borderRadius: '4px',
            margin: '1rem'
          }}>
            Error: {error}
          </div>
        )}

        {/* Items table */}
        {!loading && !error && (
          <>
            <div className="table">
              <div className="table-row table-header">
                <span>Título</span>
                <span>Tipo</span>
                <span>Estado</span>
                <span>Actualizado</span>
              </div>
              {items.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No se encontraron items
                </div>
              ) : (
                items.map((item) => (
                  <div className="table-row" key={item.id}>
                    <span className="row-title">{item.title}</span>
                    <span>{item.item_type}</span>
                    <span>
                      <span className={`pill ${item.status.toLowerCase()}`}>
                        {STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}
                      </span>
                    </span>
                    <span>{formatDate(item.updated_at)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '1rem',
                borderTop: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} de {totalCount}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="ghost-button small"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </button>
                  <span style={{ padding: '0 1rem', display: 'flex', alignItems: 'center' }}>
                    Página {page} de {totalPages}
                  </span>
                  <button 
                    className="ghost-button small"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Advanced filters modal */}
      {showAdvancedFilterModal && (
        <div className="modal-overlay" onClick={() => setShowAdvancedFilterModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configurar filtros avanzados</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAdvancedFilterModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Selecciona los atributos que deseas usar como filtros. Tu selección se guardará automáticamente.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {attributeDefinitions.map(def => (
                  <label 
                    key={def.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: selectedAdvancedFilters.includes(def.id) 
                        ? 'var(--primary-bg)' 
                        : 'transparent'
                    }}
                  >
                    <input 
                      type="checkbox"
                      checked={selectedAdvancedFilters.includes(def.id)}
                      onChange={() => toggleAdvancedFilter(def.id)}
                    />
                    <span>{def.label}</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-secondary)',
                      marginLeft: 'auto'
                    }}>
                      {def.item_type} · {def.data_type}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="ghost-button"
                onClick={() => setShowAdvancedFilterModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="primary-button"
                onClick={applyAdvancedFilterSelection}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create item modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <form onSubmit={handleCreateItem}>
              <div className="modal-header">
                <h3>Nuevo Item</h3>
                <button 
                  type="button"
                  className="modal-close"
                  onClick={() => setShowCreateModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Basic fields */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Título *
                  </label>
                  <input 
                    type="text"
                    className="input"
                    value={newItem.title}
                    onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Resumen
                  </label>
                  <textarea 
                    className="input"
                    rows={3}
                    value={newItem.summary}
                    onChange={(e) => setNewItem(prev => ({ ...prev, summary: e.target.value }))}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Tipo de ítem *
                  </label>
                  <select 
                    className="select"
                    value={newItem.item_type}
                    onChange={(e) => setNewItem(prev => ({ ...prev, item_type: e.target.value }))}
                    required
                  >
                    <option value="">Selecciona un tipo</option>
                    {itemTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    <option value="__new__">+ Crear nuevo tipo</option>
                  </select>
                  {newItem.item_type === '__new__' && (
                    <input 
                      type="text"
                      className="input"
                      placeholder="Nombre del nuevo tipo"
                      style={{ marginTop: '0.5rem' }}
                      onChange={(e) => setNewItem(prev => ({ ...prev, item_type: e.target.value }))}
                    />
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Estado *
                  </label>
                  <select 
                    className="select"
                    value={newItem.status}
                    onChange={(e) => setNewItem(prev => ({ ...prev, status: e.target.value }))}
                    required
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Dynamic attribute fields */}
                {newItem.item_type && newItem.item_type !== '__new__' && (
                  <>
                    <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
                    <h4 style={{ marginBottom: '1rem' }}>Atributos</h4>
                    {attributeDefinitions
                      .filter(def => def.item_type === newItem.item_type)
                      .map(def => (
                        <div key={def.id} style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                            {def.label} {def.is_required && '*'}
                          </label>
                          {def.data_type === 'text' && (
                            <input 
                              type="text"
                              className="input"
                              value={newItemAttributes[def.id] || ''}
                              onChange={(e) => setNewItemAttributes(prev => ({ 
                                ...prev, 
                                [def.id]: e.target.value 
                              }))}
                              required={def.is_required}
                            />
                          )}
                          {def.data_type === 'number' && (
                            <input 
                              type="number"
                              className="input"
                              value={newItemAttributes[def.id] || ''}
                              onChange={(e) => setNewItemAttributes(prev => ({ 
                                ...prev, 
                                [def.id]: e.target.value 
                              }))}
                              required={def.is_required}
                            />
                          )}
                          {def.data_type === 'boolean' && (
                            <select 
                              className="select"
                              value={newItemAttributes[def.id] || ''}
                              onChange={(e) => setNewItemAttributes(prev => ({ 
                                ...prev, 
                                [def.id]: e.target.value 
                              }))}
                              required={def.is_required}
                            >
                              <option value="">Selecciona</option>
                              <option value="true">Sí</option>
                              <option value="false">No</option>
                            </select>
                          )}
                          {def.data_type === 'date' && (
                            <input 
                              type="date"
                              className="input"
                              value={newItemAttributes[def.id] || ''}
                              onChange={(e) => setNewItemAttributes(prev => ({ 
                                ...prev, 
                                [def.id]: e.target.value 
                              }))}
                              required={def.is_required}
                            />
                          )}
                        </div>
                      ))
                    }
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="primary-button"
                >
                  Crear Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Items

