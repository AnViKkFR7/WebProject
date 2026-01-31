import Button from '../Button'
import AttributeDefinitionsForm from './AttributeDefinitionsForm'
import { useLanguage } from '../../contexts/LanguageContext'

const CreateItemTypeModal = ({
  show,
  newItemType,
  itemTypeExists,
  checkingItemType,
  selectedCompany,
  newDefinitions,
  loading,
  fileInputRef,
  handleItemTypeChange,
  handleNewDefinitionChange,
  handleRemoveRow,
  onClose,
  onSave,
  onImport,
  onDownloadTemplate
}) => {
  const { t } = useLanguage()
  
  if (!show) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('myData.createNewItemType')}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          {/* Input para nombre del tipo de ítem */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: 600, 
              marginBottom: '0.5rem',
              color: 'var(--text-primary)'
            }}>
              {t('myData.itemTypeName')} *
            </label>
            <input
              type="text"
              className="input"
              value={newItemType}
              onChange={(e) => handleItemTypeChange(e.target.value)}
              placeholder={t('myData.itemTypeNamePlaceholder')}
              style={{ width: '100%' }}
            />
            {selectedCompany && newItemType && (
              <p style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-secondary)', 
                marginTop: '0.25rem',
                fontStyle: 'italic'
              }}>
                {t('myData.savedAs')}: <strong>{newItemType.trim()}_{selectedCompany.name.trim()}</strong>
              </p>
            )}
            {checkingItemType && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {t('myData.checkingAvailability')}
              </p>
            )}
            {itemTypeExists && (
              <p style={{ fontSize: '0.75rem', color: 'var(--danger-color)', marginTop: '0.25rem' }}>
                {t('myData.itemTypeExists')}
              </p>
            )}
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {t('myData.addAttributesHelp')}
          </p>

          <AttributeDefinitionsForm
            newDefinitions={newDefinitions}
            handleNewDefinitionChange={handleNewDefinitionChange}
            handleRemoveRow={handleRemoveRow}
          />
        </div>

        <div className="modal-footer">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={onImport}
          />
          <button
            onClick={onDownloadTemplate}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-color)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: 0,
              marginRight: 'auto'
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--primary-dark)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--primary-color)'}
          >
            📥 {t('myData.downloadTemplate')}
          </button>
          <Button
            variant="ghost"
            size="medium"
            onClick={onClose}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="ghost"
            size="medium"
            onClick={() => fileInputRef.current?.click()}
          >
            📤 {t('myData.importAttributes')}
          </Button>
          <Button
            variant="primary"
            size="medium"
            onClick={onSave}
            disabled={loading || !newItemType.trim() || itemTypeExists}
          >
            {loading ? t('common.savingChanges') : `💾 ${t('common.saveChanges')}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CreateItemTypeModal
