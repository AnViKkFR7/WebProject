import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import ItemTypeSelector from '../components/myData/ItemTypeSelector'
import AttributeDefinitionsTable from '../components/myData/AttributeDefinitionsTable'
import CreateAttributeModal from '../components/myData/CreateAttributeModal'
import CreateItemTypeModal from '../components/myData/CreateItemTypeModal'
import { downloadTemplate, importExcel } from '../components/myData/excelUtils'

const MyData = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [itemTypes, setItemTypes] = useState([])
  const [selectedItemType, setSelectedItemType] = useState(null)
  const [attributeDefinitions, setAttributeDefinitions] = useState([])
  const [editableFields, setEditableFields] = useState({})
  const [originalValues, setOriginalValues] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateItemTypeModal, setShowCreateItemTypeModal] = useState(false)
  const [newItemType, setNewItemType] = useState('')
  const [itemTypeExists, setItemTypeExists] = useState(false)
  const [checkingItemType, setCheckingItemType] = useState(false)
  const [newDefinitions, setNewDefinitions] = useState([{ label: '', data_type: 'text', is_filterable: false, is_required: false }])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [savingLabel, setSavingLabel] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  const fileInputRef = useRef(null)
  const fileInputItemTypeRef = useRef(null)

  useEffect(() => {
    if (selectedCompany?.id) {
      loadData()
    }
  }, [selectedCompany?.id])

  const loadData = async () => {
    if (!selectedCompany?.id) return

    try {
      setLoading(true)
      await loadItemTypes(selectedCompany.id)
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
    if (!selectedCompany?.id) return

    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('attribute_definitions')
        .select('*')
        .eq('company_id', selectedCompany.id)
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

  const checkItemTypeExists = async (itemTypeName) => {
    if (!itemTypeName.trim() || !selectedCompany?.id) {
      setItemTypeExists(false)
      return
    }

    setCheckingItemType(true)
    try {
      // Construir el item_type completo como se guardará
      const companyNameTrimmed = selectedCompany.name.trim()
      const fullItemType = `${itemTypeName.trim()}_${companyNameTrimmed}`

      const { data, error: err } = await supabase
        .from('attribute_definitions')
        .select('item_type')
        .eq('company_id', selectedCompany.id)
        .eq('item_type', fullItemType)
        .limit(1)

      if (err) throw err

      setItemTypeExists(data && data.length > 0)
    } catch (err) {
      console.error('Error checking item type:', err)
    } finally {
      setCheckingItemType(false)
    }
  }

  const handleItemTypeChange = (value) => {
    setNewItemType(value)
    // Debounce check
    if (value.trim()) {
      const timeoutId = setTimeout(() => {
        checkItemTypeExists(value)
      }, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setItemTypeExists(false)
    }
  }

  const handleSaveNewItemType = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!newItemType.trim()) {
        setError('Debes proporcionar un nombre para el tipo de ítem')
        setLoading(false)
        return
      }

      if (itemTypeExists) {
        setError('Este tipo de ítem ya existe')
        setLoading(false)
        return
      }

      // Filtrar solo las filas que tienen label
      const validDefinitions = newDefinitions.filter(def => def.label.trim() !== '')

      if (validDefinitions.length === 0) {
        setError('Debes añadir al menos un atributo con label')
        setLoading(false)
        return
      }

      // Construir el item_type completo
      const companyNameTrimmed = selectedCompany.name.trim()
      const fullItemType = `${newItemType.trim()}_${companyNameTrimmed}`

      // Preparar los datos para insertar
      const definitionsToInsert = validDefinitions.map(def => ({
        company_id: selectedCompany.id,
        item_type: fullItemType,
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

      setSuccess(`Tipo de ítem "${fullItemType}" creado con ${validDefinitions.length} atributo(s)`)
      setShowCreateItemTypeModal(false)
      setNewItemType('')
      setItemTypeExists(false)
      setNewDefinitions([{ label: '', data_type: 'text', is_filterable: false, is_required: false }])
      await loadItemTypes(selectedCompany.id)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error creating item type:', err)
      setError(err.message || 'Error al crear el tipo de ítem')
    } finally {
      setLoading(false)
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
        company_id: selectedCompany.id,
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

  const handleImportExcel = (event) => {
    const file = event.target.files[0]
    if (!file) return

    importExcel(
      file,
      (importedDefinitions) => {
        // Añadir una fila vacía al final para poder seguir añadiendo
        setNewDefinitions([...importedDefinitions, { label: '', data_type: 'text', is_filterable: false, is_required: false }])
        setSuccess(`${importedDefinitions.length} atributo(s) importado(s) correctamente`)
        setTimeout(() => setSuccess(''), 3000)
      },
      (errorMessage) => {
        setError(errorMessage)
      }
    )
    
    // Reset input para permitir reimportar el mismo archivo
    event.target.value = ''
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setNewDefinitions([{ label: '', data_type: 'text', is_filterable: false, is_required: false }])
  }

  const handleCloseCreateItemTypeModal = () => {
    setShowCreateItemTypeModal(false)
    setNewItemType('')
    setItemTypeExists(false)
    setNewDefinitions([{ label: '', data_type: 'text', is_filterable: false, is_required: false }])
  }

  if (loading && !selectedCompany?.id) {
    return (
      <div className="page">
        <div className="page-content">
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>{t('myData.pageTitle')}</h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '800px' }}>
              {t('myData.description')}
            </p>
          </div>
          <div className="header-actions">
            <button 
              className="primary-button"
              onClick={() => setShowCreateItemTypeModal(true)}
            >
              {t('myData.createItemType')}
            </button>
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
        <ItemTypeSelector
          itemTypes={itemTypes}
          selectedItemType={selectedItemType}
          onSelectItemType={handleSelectItemType}
        />

        {/* Lista de attribute definitions */}
        <AttributeDefinitionsTable
          selectedItemType={selectedItemType}
          loading={loading}
          attributeDefinitions={attributeDefinitions}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          editableFields={editableFields}
          handleLabelChange={handleLabelChange}
          toggleEdit={toggleEdit}
          handleSaveLabel={handleSaveLabel}
          handleDiscardLabel={handleDiscardLabel}
          savingLabel={savingLabel}
          onCreateNew={() => setShowCreateModal(true)}
        />

        {/* Modal para crear nuevos attribute definitions */}
        <CreateAttributeModal
          show={showCreateModal}
          selectedItemType={selectedItemType}
          newDefinitions={newDefinitions}
          loading={loading}
          fileInputRef={fileInputRef}
          handleNewDefinitionChange={handleNewDefinitionChange}
          handleRemoveRow={handleRemoveRow}
          onClose={handleCloseCreateModal}
          onSave={handleSaveNewDefinitions}
          onImport={handleImportExcel}
          onDownloadTemplate={downloadTemplate}
        />

        {/* Modal para crear nuevo tipo de ítem */}
        <CreateItemTypeModal
          show={showCreateItemTypeModal}
          newItemType={newItemType}
          itemTypeExists={itemTypeExists}
          checkingItemType={checkingItemType}
          selectedCompany={selectedCompany}
          newDefinitions={newDefinitions}
          loading={loading}
          fileInputRef={fileInputItemTypeRef}
          handleItemTypeChange={handleItemTypeChange}
          handleNewDefinitionChange={handleNewDefinitionChange}
          handleRemoveRow={handleRemoveRow}
          onClose={handleCloseCreateItemTypeModal}
          onSave={handleSaveNewItemType}
          onImport={handleImportExcel}
          onDownloadTemplate={downloadTemplate}
        />
      </div>
    </div>
  )
}

export default MyData
