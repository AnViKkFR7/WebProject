import Modal from '../ui/Modal'
import AttributeDefinitionsForm from './AttributeDefinitionsForm'
import AttributeImportActions from './AttributeImportActions'
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

  return (
    <Modal
      open={show}
      onClose={onClose}
      size="lg"
      title={t('myData.createNewItemType')}
      footer={(
        <AttributeImportActions
          fileInputRef={fileInputRef}
          onImport={onImport}
          onDownloadTemplate={onDownloadTemplate}
          onClose={onClose}
          onSave={onSave}
          loading={loading}
          saveDisabled={!newItemType.trim() || itemTypeExists}
        />
      )}
    >
      <div className="field" style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="new-item-type" className="field-label">
          {t('myData.itemTypeName')}<span className="required-mark" aria-hidden="true">*</span>
        </label>
        <input
          id="new-item-type"
          type="text"
          className="input"
          value={newItemType}
          onChange={(e) => handleItemTypeChange(e.target.value)}
          placeholder={t('myData.itemTypeNamePlaceholder')}
          aria-invalid={itemTypeExists || undefined}
          required
        />
        {selectedCompany && newItemType && (
          <p className="field-help">
            {t('myData.savedAs')}: <strong>{newItemType.trim()}_{selectedCompany.name.trim()}</strong>
          </p>
        )}
        {checkingItemType && <p className="field-help">{t('myData.checkingAvailability')}</p>}
        {itemTypeExists && <p className="field-error" role="alert">{t('myData.itemTypeExists')}</p>}
      </div>

      <p className="modal-intro">{t('myData.addAttributesHelp')}</p>

      <AttributeDefinitionsForm
        newDefinitions={newDefinitions}
        handleNewDefinitionChange={handleNewDefinitionChange}
        handleRemoveRow={handleRemoveRow}
      />
    </Modal>
  )
}

export default CreateItemTypeModal
