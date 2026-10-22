import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { usePermissions } from '../hooks/usePermissions'
import { useDefinitionDraft } from '../hooks/useDefinitionDraft'
import { attributeDefinitionService } from '../services/attributeDefinitionService'
import { displayItemType, moveDefinition, parseLabel, uniqueKey } from '../lib/attributeTypes'
import { downloadTemplate } from '../components/myData/excelUtils'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import ItemTypeList from '../components/attributes/ItemTypeList'
import AttributeRow from '../components/attributes/AttributeRow'
import AttributeEditor from '../components/attributes/AttributeEditor'
import FormPreview from '../components/attributes/FormPreview'
import CreateAttributeModal from '../components/myData/CreateAttributeModal'
import CreateItemTypeModal from '../components/myData/CreateItemTypeModal'

// PostgREST responde PGRST204 / 42703 cuando falta una columna: sin la migración
// ATTRIBUTES_SCHEMA.sql no existen sort_order ni validation_rules
const isMissingColumn = (error) => ['PGRST204', '42703'].includes(error?.code)

const MyData = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const { toast, confirm } = useFeedback()
  const { canEdit } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedType = searchParams.get('type')

  const [types, setTypes] = useState([])
  const [typesState, setTypesState] = useState('loading') // loading | error | ready
  const [definitions, setDefinitions] = useState([])
  const [definitionsState, setDefinitionsState] = useState('idle')
  const [editor, setEditor] = useState(null) // { definition, valueCount }
  const [saving, setSaving] = useState(false)
  const [drag, setDrag] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showNewType, setShowNewType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const importInputRef = useRef(null)
  const newTypeInputRef = useRef(null)

  const companyId = selectedCompany?.id
  const companyName = selectedCompany?.name?.trim() || ''

  const reportError = useCallback((error, fallbackKey) => {
    console.error(error)
    toast.error(isMissingColumn(error) ? t('attributes.migrationNeeded') : t(fallbackKey))
  }, [toast, t])

  const draft = useDefinitionDraft({
    onImported: (count) => toast.success(t('attributes.imported').replace('{count}', count)),
    onImportError: (message) => toast.error(message),
  })

  const selectType = useCallback((itemType, replace = false) => {
    setSearchParams(itemType ? { type: itemType } : {}, { replace })
  }, [setSearchParams])

  const loadTypes = useCallback(async () => {
    if (!companyId) return
    setTypesState('loading')
    try {
      setTypes(await attributeDefinitionService.getItemTypeSummary(companyId))
      setTypesState('ready')
    } catch (error) {
      console.error('Error loading item types:', error)
      setTypesState('error')
    }
  }, [companyId])

  const loadDefinitions = useCallback(async () => {
    if (!companyId || !selectedType) return
    setDefinitionsState('loading')
    try {
      setDefinitions(await attributeDefinitionService.getDefinitions(companyId, selectedType))
      setDefinitionsState('ready')
    } catch (error) {
      console.error('Error loading definitions:', error)
      setDefinitionsState('error')
    }
  }, [companyId, selectedType])

  useEffect(() => { loadTypes() }, [loadTypes])
  useEffect(() => { loadDefinitions() }, [loadDefinitions])

  // Sin tipo en la URL (o uno de otra empresa), se abre el primero
  useEffect(() => {
    if (typesState !== 'ready' || types.length === 0) return
    if (!types.some((type) => type.itemType === selectedType)) selectType(types[0].itemType, true)
  }, [typesState, types, selectedType, selectType])

  const existingKeys = useMemo(() => definitions.map((definition) => definition.key), [definitions])

  // --- Acciones sobre un atributo ---

  const handleToggle = async (definition, field, value) => {
    setDefinitions((prev) => prev.map((d) => (d.id === definition.id ? { ...d, [field]: value } : d)))
    try {
      await attributeDefinitionService.updateDefinition(definition.id, { [field]: value })
    } catch (error) {
      setDefinitions((prev) => prev.map((d) => (d.id === definition.id ? { ...d, [field]: !value } : d)))
      reportError(error, 'attributes.saveError')
    }
  }

  const openEditor = async (definition = null) => {
    if (!definition) {
      setEditor({ definition: null, valueCount: 0 })
      return
    }
    try {
      const valueCount = await attributeDefinitionService.countValues(definition.id)
      setEditor({ definition, valueCount })
    } catch (error) {
      // Sin el recuento se puede editar igual; solo se bloquea el cambio de tipo por prudencia
      console.error(error)
      setEditor({ definition, valueCount: Infinity })
    }
  }

  const handleSave = async (fields) => {
    setSaving(true)
    try {
      if (editor.definition) {
        const { key: _key, ...updates } = fields
        await attributeDefinitionService.updateDefinition(editor.definition.id, updates)
      } else {
        await attributeDefinitionService.createDefinition({
          ...fields,
          company_id: companyId,
          item_type: selectedType,
          sort_order: definitions.length,
        })
      }
      toast.success(t('attributes.saved'))
      setEditor(null)
      await Promise.all([loadDefinitions(), loadTypes()])
    } catch (error) {
      reportError(error, 'attributes.saveError')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (definition) => {
    const name = parseLabel(definition.label).es || definition.key
    let count = 0
    try {
      count = await attributeDefinitionService.countValues(definition.id)
    } catch (error) {
      console.error(error)
    }
    const ok = await confirm({
      title: t('attributes.deleteTitle').replace('{name}', name),
      message: count > 0
        ? t('attributes.deleteImpact').replace('{count}', count)
        : t('attributes.deleteNoImpact'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    try {
      await attributeDefinitionService.deleteDefinition(definition.id)
      toast.success(t('attributes.deleted'))
      await Promise.all([loadDefinitions(), loadTypes()])
    } catch (error) {
      reportError(error, 'attributes.deleteError')
    }
  }

  const handleMove = async (from, to) => {
    const previous = definitions
    const next = moveDefinition(definitions, from, to)
    if (next === definitions) return
    setDefinitions(next)
    const changed = next.filter((d) => previous.find((p) => p.id === d.id)?.sort_order !== d.sort_order)
    try {
      await attributeDefinitionService.saveOrder(changed.map(({ id, sort_order }) => ({ id, sort_order })))
    } catch (error) {
      setDefinitions(previous)
      reportError(error, 'attributes.orderError')
    }
  }

  const dragHandlers = {
    dragState: drag,
    onDragStart: (index) => setDrag({ from: index, over: index }),
    onDragEnter: (index) => setDrag((prev) => (prev ? { ...prev, over: index } : prev)),
    onDragEnd: () => {
      if (drag && drag.over !== drag.from) handleMove(drag.from, drag.over)
      setDrag(null)
    },
  }

  // --- Creación en lote: importar Excel o nuevo tipo de item ---

  const insertDraft = async (itemType, startOrder) => {
    const keys = [...(itemType === selectedType ? existingKeys : [])]
    const rows = draft.validRows.map((row, index) => {
      const key = uniqueKey(row.label, keys)
      keys.push(key)
      return {
        company_id: companyId,
        item_type: itemType,
        key,
        label: row.label.trim(),
        data_type: row.data_type,
        is_filterable: row.is_filterable,
        is_required: row.is_required,
        sort_order: startOrder + index,
      }
    })
    await attributeDefinitionService.createDefinitions(rows)
    return rows.length
  }

  const handleImportSave = async () => {
    if (draft.validRows.length === 0) {
      toast.error(t('attributes.atLeastOne'))
      return
    }
    setSaving(true)
    try {
      const count = await insertDraft(selectedType, definitions.length)
      toast.success(t('attributes.created').replace('{count}', count))
      setShowImport(false)
      draft.reset()
      await Promise.all([loadDefinitions(), loadTypes()])
    } catch (error) {
      reportError(error, 'attributes.saveError')
    } finally {
      setSaving(false)
    }
  }

  const fullNewType = newTypeName.trim() ? `${newTypeName.trim()}_${companyName}` : ''
  const newTypeExists = Boolean(fullNewType) && types.some((type) => type.itemType === fullNewType)

  const handleNewTypeSave = async () => {
    if (!newTypeName.trim() || newTypeExists) return
    if (draft.validRows.length === 0) {
      toast.error(t('attributes.atLeastOne'))
      return
    }
    setSaving(true)
    try {
      const count = await insertDraft(fullNewType, 0)
      toast.success(t('attributes.typeCreated').replace('{name}', newTypeName.trim()).replace('{count}', count))
      closeNewType()
      await loadTypes()
      selectType(fullNewType)
    } catch (error) {
      reportError(error, 'attributes.saveError')
    } finally {
      setSaving(false)
    }
  }

  const closeImport = () => {
    setShowImport(false)
    draft.reset()
  }

  const closeNewType = () => {
    setShowNewType(false)
    setNewTypeName('')
    draft.reset()
  }

  // --- Render ---

  const newTypeButton = canEdit && (
    <button type="button" className="primary-button" onClick={() => setShowNewType(true)}>
      <Icon name="plus" size={16} />
      {t('attributes.newItemType')}
    </button>
  )

  const renderDefinitions = () => {
    if (definitionsState === 'loading' && definitions.length === 0) {
      return <p className="attr-status">{t('common.loading')}</p>
    }
    if (definitionsState === 'error') {
      return (
        <div className="error-state" role="alert">
          <span>{t('attributes.loadError')}</span>
          <button type="button" onClick={loadDefinitions}>{t('feedback.retry')}</button>
        </div>
      )
    }
    if (definitions.length === 0) {
      return (
        <EmptyState
          compact
          icon="data"
          title={t('attributes.noAttributes')}
          description={t('attributes.noAttributesHint')}
          action={canEdit && (
            <button type="button" className="primary-button" onClick={() => openEditor()}>
              <Icon name="plus" size={16} />{t('attributes.newAttribute')}
            </button>
          )}
        />
      )
    }
    return (
      <ol className="attr-list">
        {definitions.map((definition, index) => (
          <AttributeRow
            key={definition.id}
            definition={definition}
            index={index}
            total={definitions.length}
            canEdit={canEdit}
            onMove={handleMove}
            onToggle={handleToggle}
            onEdit={openEditor}
            onDelete={handleDelete}
            {...dragHandlers}
          />
        ))}
      </ol>
    )
  }

  const renderBody = () => {
    if (typesState === 'loading') return <p className="attr-status">{t('common.loading')}</p>
    if (typesState === 'error') {
      return (
        <div className="error-state" role="alert">
          <span>{t('attributes.loadError')}</span>
          <button type="button" onClick={loadTypes}>{t('feedback.retry')}</button>
        </div>
      )
    }
    if (types.length === 0) {
      return (
        <div className="card">
          <EmptyState
            icon="items"
            title={t('attributes.noTypes')}
            description={t('attributes.noTypesHint')}
            action={newTypeButton}
          />
        </div>
      )
    }

    return (
      <div className="attr-builder">
        <ItemTypeList types={types} selected={selectedType} companyName={companyName} onSelect={selectType} />

        <section className="card attr-panel" aria-labelledby="attr-panel-title">
          <header className="attr-panel-header">
            <div>
              <h3 id="attr-panel-title">{displayItemType(selectedType, companyName)}</h3>
              <p>{t('attributes.panelHelp')}</p>
            </div>
            {canEdit && (
              <div className="header-actions">
                <button type="button" className="ghost-button" onClick={() => setShowImport(true)}>
                  <Icon name="upload" size={16} />{t('attributes.importExcel')}
                </button>
                <button type="button" className="primary-button" onClick={() => openEditor()}>
                  <Icon name="plus" size={16} />{t('attributes.newAttribute')}
                </button>
              </div>
            )}
          </header>
          {renderDefinitions()}
        </section>

        {definitions.length > 0 && <FormPreview definitions={definitions} />}
      </div>
    )
  }

  return (
    <div className="page-content page-content-wide">
      <PageHeader title={t('myData.pageTitle')} description={t('attributes.description')} actions={types.length > 0 && newTypeButton} />

      {renderBody()}

      {editor && (
        <AttributeEditor
          key={editor.definition?.id || 'new'}
          open
          definition={editor.definition}
          existingKeys={existingKeys}
          valueCount={editor.valueCount}
          saving={saving}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}

      <CreateAttributeModal
        show={showImport}
        selectedItemType={displayItemType(selectedType, companyName)}
        newDefinitions={draft.rows}
        loading={saving}
        fileInputRef={importInputRef}
        handleNewDefinitionChange={draft.change}
        handleRemoveRow={draft.remove}
        onClose={closeImport}
        onSave={handleImportSave}
        onImport={draft.importFile}
        onDownloadTemplate={downloadTemplate}
      />

      <CreateItemTypeModal
        show={showNewType}
        newItemType={newTypeName}
        itemTypeExists={newTypeExists}
        checkingItemType={false}
        selectedCompany={selectedCompany}
        newDefinitions={draft.rows}
        loading={saving}
        fileInputRef={newTypeInputRef}
        handleItemTypeChange={setNewTypeName}
        handleNewDefinitionChange={draft.change}
        handleRemoveRow={draft.remove}
        onClose={closeNewType}
        onSave={handleNewTypeSave}
        onImport={draft.importFile}
        onDownloadTemplate={downloadTemplate}
      />
    </div>
  )
}

export default MyData
