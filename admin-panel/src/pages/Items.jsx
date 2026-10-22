import DatePicker from '../components/DatePicker'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { hasActiveFilters, readFiltersFromParams, writeFiltersToParams } from '../lib/itemFilters'
import { itemService } from '../services/itemService'
import { attributeDefinitionService } from '../services/attributeDefinitionService'
import { userPreferencesService } from '../services/userPreferencesService'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import MultiSelect from '../components/ui/MultiSelect'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { usePermissions } from '../hooks/usePermissions'
import { displayLabel } from '../lib/attributeLabel'

const VIEW_MODE_KEY = 'items_view_mode_v2'

const Items = () => {
  const location = useLocation()
  const { selectedCompany } = useCompany()
  const { t, language } = useLanguage()
  const { toast } = useFeedback()
  const { canEdit } = usePermissions()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedItemId, setCopiedItemId] = useState(null)

  // Mosaico por defecto. Clave nueva (_v2) para que también quien tenía
  // guardado "filas" de antes arranque en mosaico una vez.
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem(VIEW_MODE_KEY) || 'cards' } catch { return 'cards' }
  })
  const [coverUrls, setCoverUrls] = useState({}) // { itemId: url } — solo se usa en vista cards

  // ─── Filtros: viven en la URL, no en estado local ───
  // Así volver desde un item, el botón atrás o compartir el enlace conservan
  // filtros y página (antes se reseteaban al salir de la pestaña).
  const [searchParams, setSearchParams] = useSearchParams()
  const filtersKey = searchParams.toString()
  const urlFilters = useMemo(() => readFiltersFromParams(new URLSearchParams(filtersKey)), [filtersKey])
  const {
    status: statusFilter,
    itemType: itemTypeFilter,
    sort: sortByDate,
    attrs: advancedFilterValues,
    page,
  } = urlFilters

  // Una sola escritura por acción: React Router no compone dos
  // setSearchParams seguidos en el mismo tick (el segundo pisa al primero),
  // por eso cambiar un filtro ya vuelve a la página 1 aquí mismo.
  const updateFilters = useCallback((patch) => {
    setSearchParams((prev) => {
      const current = readFiltersFromParams(prev)
      const changes = typeof patch === 'function' ? patch(current) : patch
      const next = { ...current, ...changes }
      if (!('page' in changes)) next.page = 1
      return writeFiltersToParams(next)
    }, { replace: true })
  }, [setSearchParams])

  const setStatusFilter = (status) => updateFilters({ status })
  const setItemTypeFilter = (itemType) => updateFilters({ itemType })
  const setSortByDate = (sort) => updateFilters({ sort })
  const setAdvancedFilterValues = (updater) =>
    updateFilters((current) => ({ attrs: typeof updater === 'function' ? updater(current.attrs) : updater }))
  const setPage = (next) =>
    updateFilters((current) => ({ page: typeof next === 'function' ? next(current.page) : next }))

  // El input de título es local (respuesta inmediata al teclear) y se vuelca
  // a la URL con debounce
  const [titleSearch, setTitleSearch] = useState(urlFilters.q)

  // Pagination
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  // User and company
  const [userId, setUserId] = useState(null)

  // Item types available
  const [itemTypes, setItemTypes] = useState([])

  // Advanced filters
  const [showAdvancedFilterModal, setShowAdvancedFilterModal] = useState(false)
  const [attributeDefinitions, setAttributeDefinitions] = useState([])
  const [metadataLoaded, setMetadataLoaded] = useState(false)
  const [selectedAdvancedFilters, setSelectedAdvancedFilters] = useState([]) // Array of definition IDs
  const [filterOptions, setFilterOptions] = useState({}) // { definitionId: string[] } de toda la empresa

  // Create item modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newItem, setNewItem] = useState({
    title: '',
    summary: '',
    status: 'draft',
    item_type: ''
  })
  const [newItemAttributes, setNewItemAttributes] = useState({})

  const STATUS_OPTIONS = [
    { value: 'draft', label: t('items.draft') },
    { value: 'published', label: t('items.published') },
    { value: 'archived', label: t('items.archived') }
  ]

  // Persist view mode preference
  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode) } catch { /* almacenamiento bloqueado */ }
  }, [viewMode])

  // Si la URL cambia desde fuera (atrás, "borrar filtros"), el input la sigue
  const qParam = urlFilters.q
  useEffect(() => {
    setTitleSearch(qParam)
  }, [qParam])

  // Debounce del texto de búsqueda por título antes de escribirlo en la URL
  useEffect(() => {
    if (titleSearch.trim() === qParam) return
    const handle = setTimeout(() => updateFilters({ q: titleSearch }), 350)
    return () => clearTimeout(handle)
  }, [titleSearch, qParam, updateFilters])

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    loadUser()
  }, [])

  // Load attribute definitions and item types
  useEffect(() => {
    if (!selectedCompany?.id) return

    const loadMetadata = async () => {
      try {
        const [definitions, types] = await Promise.all([
          attributeDefinitionService.getDefinitions(selectedCompany.id),
          attributeDefinitionService.getUniqueItemTypes(selectedCompany.id)
        ])
        setAttributeDefinitions(definitions)
        setItemTypes(types)
      } catch (err) {
        console.error('Error loading metadata:', err)
      } finally {
        setMetadataLoaded(true)
      }
    }

    loadMetadata()
  }, [selectedCompany?.id])

  // Filtros avanzados visibles: los elegidos por el usuario + cualquiera que
  // venga activo en la URL (p. ej. de un enlace compartido)
  const visibleAdvancedFilters = useMemo(() => {
    const fromUrl = Object.keys(advancedFilterValues).filter((id) => advancedFilterValues[id]?.length)
    return Array.from(new Set([...selectedAdvancedFilters, ...fromUrl]))
  }, [selectedAdvancedFilters, advancedFilterValues])

  // Opciones de cada filtro avanzado, de toda la empresa
  const visibleDefinitions = useMemo(
    () => attributeDefinitions.filter((def) => visibleAdvancedFilters.includes(def.id)),
    [attributeDefinitions, visibleAdvancedFilters]
  )
  useEffect(() => {
    if (visibleDefinitions.length === 0) return
    let cancelled = false
    itemService.getAttributeFilterOptions(visibleDefinitions)
      .then((options) => { if (!cancelled) setFilterOptions(options) })
      .catch((err) => console.error('Error loading filter options:', err))
    return () => { cancelled = true }
  }, [visibleDefinitions])

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
  const [reloadKey, setReloadKey] = useState(0)
  const hasAttrFilters = Object.values(advancedFilterValues).some((values) => values.length)
  useEffect(() => {
    if (!selectedCompany?.id) return
    // Los filtros por atributo necesitan el tipo de dato de cada definición
    if (hasAttrFilters && !metadataLoaded) return

    let cancelled = false
    const loadItems = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await itemService.getItemsByAdvancedFilters(
          selectedCompany.id,
          {
            status: statusFilter,
            item_type: itemTypeFilter,
            sort_by_date: sortByDate,
            title_search: urlFilters.q,
          },
          advancedFilterValues,
          page,
          pageSize,
          attributeDefinitions
        )
        if (cancelled) return
        setItems(result.data)
        setTotalCount(result.count)
        setTotalPages(result.totalPages)
      } catch (err) {
        if (cancelled) return
        console.error('Error loading items:', err)
        setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadItems()
    return () => { cancelled = true }
    // filtersKey resume todo el estado de filtros de la URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id, filtersKey, metadataLoaded, attributeDefinitions, reloadKey])

  // Load cover images only for the card view — avoids the extra query when
  // browsing in row view, where no image is shown.
  useEffect(() => {
    if (viewMode !== 'cards' || items.length === 0) {
      setCoverUrls({})
      return
    }

    let cancelled = false
    itemService.getItemMediaSummaries(items.map((item) => item.id))
      .then((summaries) => {
        if (cancelled) return
        const map = {}
        summaries.forEach((s) => {
          if (s.cover_url) map[s.item_id] = s.cover_url
        })
        setCoverUrls(map)
      })
      .catch((err) => console.error('Error loading cover images:', err))

    return () => { cancelled = true }
  }, [items, viewMode])

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
  const applyAdvancedFilterSelection = async () => {
    await saveFilterPreferences(selectedAdvancedFilters)
    setShowAdvancedFilterModal(false)
  }

  // Clear advanced filters
  const clearAdvancedFilters = async () => {
    setSelectedAdvancedFilters([])
    await saveFilterPreferences([])
  }

  // Opciones de un filtro avanzado: valores de toda la empresa, más los ya
  // seleccionados (por si vienen de un enlace y no están entre las opciones)
  const getUniqueValuesForAttribute = (definitionId) => {
    const selected = advancedFilterValues[definitionId] || []
    return Array.from(new Set([...(filterOptions[definitionId] || []), ...selected]))
  }

  // Clear all filters
  const clearAllFilters = () => {
    setTitleSearch('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  // Create item
  const handleCreateItem = async (e) => {
    e.preventDefault()

    if (!selectedCompany?.id) {
      toast.error(t('feedback.noCompanySelected'))
      return
    }

    try {
      const itemData = {
        ...newItem,
        company_id: selectedCompany.id
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
      setReloadKey(k => k + 1)
    } catch (err) {
      console.error('Error creating item:', err)
      toast.error(`${t('items.creatingItemError')}: ${err.message}`)
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

    if (diffMins < 1) return t('items.relativeNow')
    if (diffMins < 60) {
      const prefix = t('items.relativeMinutesPrefix')
      const suffix = t('items.relativeMinutesSuffix')
      return `${prefix}${diffMins}${suffix}`
    }
    if (diffHours < 24) {
      const prefix = t('items.relativeHoursPrefix')
      const suffix = t('items.relativeHoursSuffix')
      return `${prefix}${diffHours}${suffix}`
    }
    if (diffDays < 7) {
      const prefix = t('items.relativeDaysPrefix')
      const suffix = t('items.relativeDaysSuffix')
      return `${prefix}${diffDays}${suffix}`
    }

    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const detailState = { fromSearch: location.search }

  const filtersActive = hasActiveFilters(urlFilters)
  const itemsEmpty = (
    <EmptyState
      title={t('items.noItemsFound')}
      description={filtersActive ? t('items.noItemsFilteredHint') : t('items.noItemsHint')}
      action={filtersActive
        ? <button type="button" className="ghost-button" onClick={clearAllFilters}>{t('items.clearFilters')}</button>
        : canEdit && <button type="button" className="primary-button" onClick={() => setShowCreateModal(true)}><Icon name="plus" size={16} />{t('items.newItem')}</button>}
    />
  )

  const handleShare = async (e, itemId) => {
    e.stopPropagation()
    try {
      const url = `${window.location.origin}/items/${itemId}`
      await navigator.clipboard.writeText(url)
      setCopiedItemId(itemId)
      setTimeout(() => setCopiedItemId(null), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  return (
    <div className="page-content">
      <PageHeader
        title={t('items.title')}
        description={t('items.description')}
        actions={(
          <>
            <div className="segmented" role="group" aria-label={t('items.viewMode')}>
              <button
                type="button"
                onClick={() => setViewMode('rows')}
                title={t('items.viewRows')}
                aria-label={t('items.viewRows')}
                aria-pressed={viewMode === 'rows'}
              >
                <Icon name="list" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title={t('items.viewCards')}
                aria-label={t('items.viewCards')}
                aria-pressed={viewMode === 'cards'}
              >
                <Icon name="grid" size={18} />
              </button>
            </div>
            {canEdit && (
              <button type="button" className="primary-button" onClick={() => setShowCreateModal(true)}>
                <Icon name="plus" size={16} />
                {t('items.newItem')}
              </button>
            )}
          </>
        )}
      />

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
            <div className="items-filter">
              <MultiSelect
                label={t('items.statusFilterLabel')}
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>

            <div className="items-filter">
              <MultiSelect
                label={t('items.itemTypeFilterLabel')}
                options={itemTypes.map(type => ({ value: type, label: type }))}
                value={itemTypeFilter}
                onChange={setItemTypeFilter}
              />
            </div>

                        {/* Sort by date */}
            <div className="items-filter">
              <label htmlFor="items-sort" className="field-label">
                {t('items.sortByDate')}
              </label>
              <select
                id="items-sort"
                className="select"
                value={sortByDate || ''}
                onChange={(e) => {
                  setSortByDate(e.target.value || null)
                }}
              >
                <option value="">{t('items.sortNewest')}</option>
                <option value="asc">{t('items.sortOldest')}</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <button
                type="button"
                className="ghost-button small"
                onClick={() => setShowAdvancedFilterModal(true)}
              >
                <Icon name="filter" size={16} />
                {t('items.advancedFilters')} ({selectedAdvancedFilters.length})
              </button>
              <button
                type="button"
                className="ghost-button small"
                onClick={clearAllFilters}
              >
                {t('items.clearFilters')}
              </button>
            </div>
          </div>

          {/* Advanced filters */}
          {visibleAdvancedFilters.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              width: '100%'
            }}>
              {visibleAdvancedFilters.map(defId => {
                const definition = attributeDefinitions.find(d => d.id === defId)
                if (!definition) return null

                const availableValues = getUniqueValuesForAttribute(defId)

                return (
                  <div key={defId} className="items-filter">
                    <MultiSelect
                      label={displayLabel(definition.label)}
                      options={availableValues.map(value => ({ value, label: value }))}
                      value={advancedFilterValues[defId] || []}
                      onChange={(selected) => setAdvancedFilterValues(prev => ({
                        ...prev,
                        [defId]: selected
                      }))}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Filtro de texto por título */}
          <div style={{
            width: '100%',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <label htmlFor="items-title-search" className="field-label">
              {t('items.searchTitleLabel')}
            </label>
            <input
              id="items-title-search"
              type="search"
              className="input"
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.target.value)}
              placeholder={t('items.searchTitlePlaceholder')}
              style={{ maxWidth: '400px', width: '100%' }}
            />
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            {t('items.loadingItems')}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="error-state" role="alert" style={{ margin: '1rem' }}>
            <span>{t('items.errorLabel')}: {error}</span>
            <button type="button" onClick={() => setReloadKey(k => k + 1)}>{t('feedback.retry')}</button>
          </div>
        )}

        {/* Items: tabla o cards según viewMode */}
        {!loading && !error && (
          <>
            {viewMode === 'rows' ? (
              <div className="table">
                <div className="table-row table-header">
                  <span>{t('items.titleColumn')}</span>
                  <span>{t('items.typeColumn')}</span>
                  <span>{t('items.statusColumn')}</span>
                  <span>{t('items.updatedColumn')}</span>
                  <span>{t('common.actions')}</span>
                </div>
                {items.length === 0 ? (
                  itemsEmpty
                ) : (
                  items.map((item) => (
                    <div className="table-row is-linked" key={item.id}>
                      <Link className="row-title stretched-link" to={`/items/${item.id}`} state={detailState}>
                        {item.title}
                      </Link>
                      <span>{item.item_type}</span>
                      <span>
                        <span className={`pill ${item.status.toLowerCase()}`}>
                          {STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}
                        </span>
                      </span>
                      <span>{formatDate(item.updated_at)}</span>
                      <span>
                        <button
                          type="button"
                          className="ghost-button small row-action"
                          onClick={(e) => handleShare(e, item.id)}
                          title={t('common.share')}
                        >
                          <Icon name={copiedItemId === item.id ? 'check' : 'link'} size={16} />
                          {copiedItemId === item.id ? t('common.copied') : t('common.share')}
                        </button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              items.length === 0 ? (
                itemsEmpty
              ) : (
                <div className="items-cards-grid">
                  {items.map((item) => (
                    <div className="item-card" key={item.id}>
                      <div className="item-card-image">
                        {coverUrls[item.id] ? (
                          <img src={coverUrls[item.id]} alt="" loading="lazy" />
                        ) : (
                          <span className="item-card-placeholder"><Icon name="image" size={36} strokeWidth={1.25} /></span>
                        )}
                      </div>
                      <div className="item-card-body">
                        <Link className="item-card-title stretched-link" to={`/items/${item.id}`} state={detailState} title={item.title}>
                          {item.title}
                        </Link>
                        <span>
                          <span className={`pill ${item.status.toLowerCase()}`}>
                            {STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

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
                  {t('items.showing')} {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} {t('items.of')} {totalCount}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="ghost-button small"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    {t('items.prevPage')}
                  </button>
                  <span style={{ padding: '0 1rem', display: 'flex', alignItems: 'center' }}>
                    {t('items.pageLabel')} {page} {t('items.of')} {totalPages}
                  </span>
                  <button
                    className="ghost-button small"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    {t('items.nextPage')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Advanced filters modal */}
      <Modal
        open={showAdvancedFilterModal}
        onClose={() => setShowAdvancedFilterModal(false)}
        title={t('items.advancedFiltersTitle')}
        description={t('items.advancedFiltersDescription')}
        footer={(
          <>
            <button type="button" className="ghost-button modal-footer-start" onClick={clearAdvancedFilters}>
              {t('items.clearFilters')}
            </button>
            <button type="button" className="ghost-button" onClick={() => setShowAdvancedFilterModal(false)}>
              {t('items.cancel')}
            </button>
            <button type="button" className="primary-button" onClick={applyAdvancedFilterSelection}>
              {t('items.apply')}
            </button>
          </>
        )}
      >
        <div className="check-list">
          {attributeDefinitions.map(def => (
            <label key={def.id} className="check-list-row">
              <input
                type="checkbox"
                checked={selectedAdvancedFilters.includes(def.id)}
                onChange={() => toggleAdvancedFilter(def.id)}
              />
              <span>{displayLabel(def.label)}</span>
              <span className="check-list-meta">{def.item_type} · {def.data_type}</span>
            </label>
          ))}
        </div>
      </Modal>

            {/* Create item modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        size="xl"
        className="create-item-modal"
        title={t('items.newItemModalTitle')}
        footer={(
          <>
            <button type="button" className="ghost-button" onClick={() => setShowCreateModal(false)}>
              {t('items.cancel')}
            </button>
            <button type="submit" form="create-item-form" className="primary-button">
              {t('items.createItemButton')}
            </button>
          </>
        )}
      >
            <form id="create-item-form" onSubmit={handleCreateItem}>
                {/* Basic fields section */}
                <div className="modal-section">
                  <h4 className="modal-section-title">{t('items.basicInfoTitle')}</h4>

                  <div className={`attribute-field ${!newItem.title ? 'required' : ''}`} style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      {t('items.titleLabel')} <span className="required-indicator">*</span>
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
                      {t('items.summaryLabel')}
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      value={newItem.summary}
                      onChange={(e) => setNewItem(prev => ({ ...prev, summary: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className={`attribute-field ${!newItem.item_type ? 'required' : ''}`}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                        {t('items.itemType')} <span className="required-indicator">*</span>
                      </label>
                      <select
                        className="select"
                        value={newItem.item_type}
                        onChange={(e) => setNewItem(prev => ({ ...prev, item_type: e.target.value }))}
                        required
                      >
                        <option value="">{t('items.selectItemType')}</option>
                        {itemTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                        <option value="__new__">{t('items.createNewItemType')}</option>
                      </select>
                      {newItem.item_type === '__new__' && (
                        <input
                          type="text"
                          className="input"
                          placeholder={t('items.newItemTypeNamePlaceholder')}
                          style={{ marginTop: '0.5rem' }}
                          onChange={(e) => setNewItem(prev => ({ ...prev, item_type: e.target.value }))}
                        />
                      )}
                    </div>

                    <div className={`attribute-field ${!newItem.status ? 'required' : ''}`}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                        {t('items.statusLabel')} <span className="required-indicator">*</span>
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
                  </div>
                </div>

                {/* Dynamic attribute fields */}
                {newItem.item_type && newItem.item_type !== '__new__' && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">{t('items.attributesTitle')}</h4>
                    <div className="attributes-grid">
                      {attributeDefinitions
                        // Ya vienen en el orden definido en Atributos (sort_order)
                        .filter(def => def.item_type === newItem.item_type)
                        .map(def => {
                          const hasValue = newItemAttributes[def.id] && newItemAttributes[def.id] !== '';
                          const shouldShowRequired = def.is_required && !hasValue;

                          return (
                          <div key={def.id} className={`attribute-field ${shouldShowRequired ? 'required' : ''} ${def.data_type === 'longtext' ? 'longtext-field' : ''}`}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.9rem' }}>
                              {displayLabel(def.label)} {def.is_required && <span className="required-indicator">*</span>}
                            </label>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontWeight: 400, marginTop: '0.1rem' }}>
                              {def.data_type}
                            </div>
                            {(def.data_type === 'text' && !def.validation_rules?.options) && (
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
                            {def.data_type === 'longtext' && (
                              <textarea
                                className="input"
                                rows={4}
                                value={newItemAttributes[def.id] || ''}
                                onChange={(e) => setNewItemAttributes(prev => ({
                                  ...prev,
                                  [def.id]: e.target.value
                                }))}
                                required={def.is_required}
                                style={{ resize: 'vertical' }}
                              />
                            )}
                            {(def.data_type === 'integer' || def.data_type === 'decimal' || def.data_type === 'number') && (
                              <input
                                type="text"
                                inputMode="numeric"
                                className="input"
                                value={newItemAttributes[def.id] || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Allow empty, numbers, minus sign, and decimal point
                                  if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                    setNewItemAttributes(prev => ({
                                      ...prev,
                                      [def.id]: value
                                    }));
                                  }
                                }}
                                required={def.is_required}
                                placeholder={def.data_type === 'decimal' ? '0.00' : '0'}
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
                                <option value="">{t('items.selectOption')}</option>
                                <option value="true">{t('common.yes')}</option>
                                <option value="false">{t('common.no')}</option>
                              </select>
                            )}
                            {def.data_type === 'date' && (
                              <DatePicker
                                label={displayLabel(def.label)}
                                value={newItemAttributes[def.id] || ''}
                                onChange={date => setNewItemAttributes(prev => ({ ...prev,[def.id]:date }))}
                                required={def.is_required}
                              />
                            )}
                            {def.validation_rules?.options && (
                              <select
                                className="select"
                                value={newItemAttributes[def.id] || ''}
                                onChange={(e) => setNewItemAttributes(prev => ({
                                  ...prev,
                                  [def.id]: e.target.value
                                }))}
                                required={def.is_required}
                              >
                                <option value="">{t('items.selectOptionGeneric')}</option>
                                {def.validation_rules.options.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}
                            {def.data_type === 'text_array' && (
                              <div>
                                {Array.isArray(newItemAttributes[def.id]) && newItemAttributes[def.id].length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {newItemAttributes[def.id].map((item, index) => (
                                      <div key={index} className="array-item">
                                        <span className="array-index">{index + 1}.</span>
                                        <span style={{ flex: 1, fontSize: '0.875rem' }}>{item}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newArray = newItemAttributes[def.id].filter((_, i) => i !== index)
                                            setNewItemAttributes(prev => ({
                                              ...prev,
                                              [def.id]: newArray.length > 0 ? newArray : []
                                            }))
                                          }}
                                          className="icon-button danger"
                                          aria-label={t('common.delete')}
                                        >
                                          <Icon name="close" size={16} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <input
                                    type="text"
                                    className="input"
                                    placeholder={t('items.newArrayItemPlaceholder')}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        const val = e.target.value.trim()
                                        if (val) {
                                          const current = Array.isArray(newItemAttributes[def.id]) ? newItemAttributes[def.id] : []
                                          setNewItemAttributes(prev => ({
                                            ...prev,
                                            [def.id]: [...current, val]
                                          }))
                                          e.target.value = ''
                                        }
                                      }
                                    }}
                                    style={{ flex: 1, fontSize: '0.875rem' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const input = e.target.parentElement.querySelector('input')
                                      const val = input.value.trim()
                                      if (val) {
                                        const current = Array.isArray(newItemAttributes[def.id]) ? newItemAttributes[def.id] : []
                                        setNewItemAttributes(prev => ({
                                          ...prev,
                                          [def.id]: [...current, val]
                                        }))
                                        input.value = ''
                                      }
                                    }}
                                    className="primary-button small"
                                  >
                                    <Icon name="plus" size={14} />
                                    {t('items.addItem')}
                                  </button>
                                </div>
                              </div>
                            )}
                            {def.data_type === 'number_array' && (
                              <div>
                                {Array.isArray(newItemAttributes[def.id]) && newItemAttributes[def.id].length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {newItemAttributes[def.id].map((item, index) => (
                                      <div key={index} className="array-item">
                                        <span className="array-index">{index + 1}.</span>
                                        <span style={{ flex: 1, fontSize: '0.875rem' }}>{item}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newArray = newItemAttributes[def.id].filter((_, i) => i !== index)
                                            setNewItemAttributes(prev => ({
                                              ...prev,
                                              [def.id]: newArray.length > 0 ? newArray : []
                                            }))
                                          }}
                                          className="icon-button danger"
                                          aria-label={t('common.delete')}
                                        >
                                          <Icon name="close" size={16} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <input
                                    type="number"
                                    className="input"
                                    placeholder={t('items.newArrayNumberPlaceholder')}
                                    step="any"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        const val = e.target.value.trim()
                                        if (val) {
                                          const current = Array.isArray(newItemAttributes[def.id]) ? newItemAttributes[def.id] : []
                                          setNewItemAttributes(prev => ({
                                            ...prev,
                                            [def.id]: [...current, parseFloat(val)]
                                          }))
                                          e.target.value = ''
                                        }
                                      }
                                    }}
                                    style={{ flex: 1, fontSize: '0.875rem' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const input = e.target.parentElement.querySelector('input')
                                      const val = input.value.trim()
                                      if (val) {
                                        const current = Array.isArray(newItemAttributes[def.id]) ? newItemAttributes[def.id] : []
                                        setNewItemAttributes(prev => ({
                                          ...prev,
                                          [def.id]: [...current, parseFloat(val)]
                                        }))
                                        input.value = ''
                                      }
                                    }}
                                    className="primary-button small"
                                  >
                                    <Icon name="plus" size={14} />
                                    {t('items.addItem')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          )
                        })
                      }
                    </div>
                  </div>
                )}
            </form>
      </Modal>
    </div>
  )
}

export default Items

