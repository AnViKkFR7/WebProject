import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { itemService } from '../services/itemService'
import { attributeDefinitionService } from '../services/attributeDefinitionService'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../contexts/LanguageContext'

// Import subcomponents
import ItemDetailHeader from '../components/itemDetails/ItemDetailHeader'
import ItemBasicInfo from '../components/itemDetails/ItemBasicInfo'
import ItemMedia from '../components/itemDetails/ItemMedia'
import AttributesList from '../components/itemDetails/AttributesList'
import ItemDetailFooter from '../components/itemDetails/ItemDetailFooter'
import Icon from '../components/ui/Icon'
import { slugify } from '../lib/contentSeo'

const ItemDetail = () => {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const listUrl = '/items' + (location.state?.fromSearch || '')
  const { t } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)

  const [item, setItem] = useState(null)
  const [itemData, setItemData] = useState({
    title: '',
    summary: '',
    status: 'draft',
    item_type: '',
    slug: '',
    seo_title: '',
    seo_description: '',
    seo_og_image_url: '',
  })
  const [attributeValues, setAttributeValues] = useState({})
  const [attributeDefinitions, setAttributeDefinitions] = useState([])
  const [editableFields, setEditableFields] = useState({})
  const [originalItemData, setOriginalItemData] = useState(null)

  const [canEdit, setCanEdit] = useState(false)

  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const [searchFilter, setSearchFilter] = useState('')
  const [changedFieldsCount, setChangedFieldsCount] = useState(0)

  // Requerido/Filtrable ya no se editan aquí (afectan a todos los items del tipo): están en /my-data
  useEffect(() => {
    const valueChanges = Object.values(attributeValues).filter(v => v.edited).length
    let basicInfoChanges = 0
    if (originalItemData) {
      if (itemData.title !== originalItemData.title) basicInfoChanges++
      if (itemData.summary !== originalItemData.summary) basicInfoChanges++
      if (itemData.status !== originalItemData.status) basicInfoChanges++
      for (const field of ['slug', 'seo_title', 'seo_description', 'seo_og_image_url']) {
        if ((itemData[field] || '') !== (originalItemData[field] || '')) basicInfoChanges++
      }
    }
    setChangedFieldsCount(valueChanges + basicInfoChanges)
  }, [attributeValues, itemData, originalItemData])

  const loadItemData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAccessDenied(false)

    try {
      if (!itemId) {
        setError(t('itemDetail.error'))
        setLoading(false)
        return
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      const itemData = await itemService.getItemById(itemId)

      if (!itemData) {
        setError(t('itemDetail.error'))
        setLoading(false)
        return
      }

      const { data: membership, error: membershipError } = await supabase
        .from('company_members')
        .select('role')
        .eq('is_active', true)
        .eq('user_id', currentUser.id)
        .eq('company_id', itemData.company_id)
        .single()

      if (membershipError || !membership) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      setCanEdit(membership.role === 'admin' || membership.role === 'editor')

      setItem(itemData)
      const basicData = {
        title: itemData.title || '',
        summary: itemData.summary || '',
        status: itemData.status || 'draft',
        item_type: itemData.item_type || '',
        slug: itemData.slug || '',
        seo_title: itemData.seo_title || '',
        seo_description: itemData.seo_description || '',
        seo_og_image_url: itemData.seo_og_image_url || '',
      }
      setItemData(basicData)
      setOriginalItemData(basicData)

      const definitions = await attributeDefinitionService.getDefinitions(itemData.company_id, itemData.item_type)
      setAttributeDefinitions(definitions)

      const valuesMap = {}
      if (itemData.attribute_values) {
        itemData.attribute_values.forEach(av => {
          const def = av.attribute_definitions
          if (!def) return

          let value
          switch (def.data_type) {
            case 'text':
              value = av.value_text
              break
            case 'integer':
            case 'decimal':
            case 'number':
              value = av.value_number
              break
            case 'boolean':
              value = av.value_boolean
              break
            case 'date':
              value = av.value_date
              break
            case 'text_array':
              value = av.value_text_array
              break
            case 'number_array':
              value = av.value_number_array
              break
            default:
              value = av.value_text
          }

          valuesMap[av.attribute_id] = {
            value,
            originalValue: value,
            edited: false,
            attributeValueId: av.id
          }
        })
      }
      setAttributeValues(valuesMap)

    } catch (err) {
      console.error('Error loading item:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [itemId, t])

  useEffect(() => {
    loadItemData()
  }, [loadItemData])

  const toggleFieldEditable = (fieldId) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }))
  }

  const discardFieldChanges = (attributeId) => {
    const valueData = attributeValues[attributeId]
    if (!valueData) return

    setAttributeValues(prev => ({
      ...prev,
      [attributeId]: {
        ...prev[attributeId],
        value: valueData.originalValue,
        edited: false
      }
    }))
    setEditableFields(prev => ({
      ...prev,
      [`attr-${attributeId}`]: false
    }))
  }

  const updateAttributeValue = (attributeId, newValue) => {
    setAttributeValues(prev => {
      const current = prev[attributeId] || { originalValue: null, edited: false, attributeValueId: null }
      return {
        ...prev,
        [attributeId]: {
          ...current,
          value: newValue,
          edited: current.originalValue !== newValue
        }
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccessMessage('')
    setError(null)

    try {
      // Validar portada obligatoria si se está publicando el item
      if (itemData.status === 'published' && item.status !== 'published') {
        // El item está cambiando a estado publicado, verificar portada
        const { data: images, error: mediaError } = await supabase
          .from('item_media')
          .select('id, is_cover')
          .eq('item_id', itemId)
          .eq('file_type', 'image')

        if (mediaError) throw mediaError

        const hasCover = images && images.some(img => img.is_cover === true)

        if (images && images.length > 0 && !hasCover) {
          throw new Error(t('itemMedia.coverRequiredToPublish') || 'Para publicar un item con imágenes, debe tener una imagen de portada.')
        }
      }

      const itemUpdates = {
        title: itemData.title,
        summary: itemData.summary,
        status: itemData.status
      }
      if (editableFields.seo) {
        const image = itemData.seo_og_image_url.trim()
        if (image && !/^https:\/\//i.test(image)) throw new Error(t('seo.invalidImageUrl'))
        itemUpdates.slug = slugify(itemData.slug) || null
        itemUpdates.seo_title = itemData.seo_title.trim() || null
        itemUpdates.seo_description = itemData.seo_description.trim() || null
        itemUpdates.seo_og_image_url = image || null
      }
      await itemService.updateItem(itemId, itemUpdates)

      for (const [attributeId, valueData] of Object.entries(attributeValues)) {
        if (!valueData.edited) continue

        const definition = attributeDefinitions.find(d => d.id === attributeId)
        if (!definition) continue

        const attributeValueData = {
          item_id: itemId,
          attribute_id: attributeId
        }

        const value = valueData.value
        switch (definition.data_type) {
          case 'text':
          case 'longtext':
            attributeValueData.value_text = value
            break
          case 'integer':
          case 'decimal':
          case 'number':
            attributeValueData.value_number = value ? parseFloat(value) : null
            break
          case 'boolean':
            attributeValueData.value_boolean = value === 'true' || value === true
            break
          case 'date':
            attributeValueData.value_date = value
            break
          case 'text_array':
            attributeValueData.value_text_array = Array.isArray(value) ? value : [value]
            break
          case 'number_array':
            attributeValueData.value_number_array = Array.isArray(value)
              ? value.map(v => parseFloat(v))
              : [parseFloat(value)]
            break
          default:
            attributeValueData.value_text = value
        }

        await itemService.upsertAttributeValue(attributeValueData)
      }

      setSuccessMessage(t('itemDetail.itemUpdated'))
      setTimeout(() => setSuccessMessage(''), 3000)

      // Clear local changes and reset editable fields
      setEditableFields({})
      await loadItemData()

    } catch (err) {
      console.error('Error saving item:', err)
      setError(t('itemDetail.errorSaving') + ': ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate(listUrl)
  }

  if (loading) {
    return (
      <div className="page-content">
        <ItemDetailHeader loading={true} />
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-primary)',
          overflow: 'hidden'
        }}>
          <ItemBasicInfo loading={true} />
          <AttributesList loading={true} />
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="page-content">
        <div style={{
          maxWidth: '600px',
          margin: '3rem auto',
          padding: '2rem',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-primary)'
        }}>
          <div className="placeholder-icon"><Icon name="lock" size={48} strokeWidth={1.25} /></div>
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>{t('itemDetail.accessDenied')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {t('itemDetail.accessDeniedMessage')}
          </p>
          <button
            className="btn-primary"
            onClick={() => navigate('/login')}
          >
            {t('itemDetail.goToLogin')}
          </button>
        </div>
      </div>
    )
  }

  if (error && !item) {
    return (
      <div className="page-content">
        <div style={{
          maxWidth: '600px',
          margin: '3rem auto',
          padding: '2rem',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-primary)'
        }}>
          <h3 style={{ color: 'var(--text-color)', marginBottom: '1rem' }}>{t('itemDetail.error')}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button
            className="btn-secondary"
            onClick={() => navigate(listUrl)}
            style={{ marginTop: '1rem' }}
          >
            {t('itemDetail.backToItems')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <ItemDetailHeader item={item} loading={false} />

      {successMessage && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#dcfce7',
          color: '#15803d',
          borderRadius: '8px',
          margin: '1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid #15803d'
        }}>
          <Icon name="check" size={16} /> {successMessage}
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee',
          color: '#f44336',
          borderRadius: '8px',
          margin: '1rem 0',
          border: '1px solid #f44336'
        }}>
          {error}
        </div>
      )}

      <ItemBasicInfo
        itemData={itemData}
        setItemData={setItemData}
        canEdit={canEdit}
        loading={false}
        editableFields={editableFields}
        onToggleEditable={toggleFieldEditable}
      />

      <ItemMedia
        itemId={itemId}
        canEdit={canEdit}
      />

      <AttributesList
        attributeDefinitions={attributeDefinitions}
        attributeValues={attributeValues}
        editableFields={editableFields}
        canEdit={canEdit}
        searchFilter={searchFilter}
        onToggleEditable={toggleFieldEditable}
        onDiscard={discardFieldChanges}
        onUpdate={updateAttributeValue}
        onSearchChange={setSearchFilter}
        loading={false}
      />

      {canEdit && (
        <ItemDetailFooter
          changedFieldsCount={changedFieldsCount}
          saving={saving}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default ItemDetail
