import Modal from '../ui/Modal'
import AttributeDefinitionsForm from './AttributeDefinitionsForm'
import AttributeImportActions from './AttributeImportActions'
import { useLanguage } from '../../contexts/LanguageContext'

const CreateAttributeModal = ({
  show,
  selectedItemType,
  newDefinitions,
  loading,
  fileInputRef,
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
      title={`${t('myData.createAttributeDefinition')} - ${selectedItemType}`}
      description={t('myData.addAttributesHelp')}
      footer={(
        <AttributeImportActions
          fileInputRef={fileInputRef}
          onImport={onImport}
          onDownloadTemplate={onDownloadTemplate}
          onClose={onClose}
          onSave={onSave}
          loading={loading}
        />
      )}
    >
      <AttributeDefinitionsForm
        newDefinitions={newDefinitions}
        handleNewDefinitionChange={handleNewDefinitionChange}
        handleRemoveRow={handleRemoveRow}
      />
    </Modal>
  )
}

export default CreateAttributeModal
