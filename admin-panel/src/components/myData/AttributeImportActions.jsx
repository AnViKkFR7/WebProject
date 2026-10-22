import Button from '../Button'
import Icon from '../ui/Icon'
import { useLanguage } from '../../contexts/LanguageContext'

/** Pie común de los modales de atributos: plantilla Excel, importar, cancelar y guardar. */
const AttributeImportActions = ({ fileInputRef, onImport, onDownloadTemplate, onClose, onSave, loading, saveDisabled }) => {
  const { t } = useLanguage()
  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls"
        hidden
        onChange={onImport}
      />
      <button type="button" className="link-button modal-footer-start" onClick={onDownloadTemplate}>
        <Icon name="download" size={16} />
        {t('myData.downloadTemplate')}
      </button>
      <Button variant="ghost" size="medium" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button variant="ghost" size="medium" onClick={() => fileInputRef.current?.click()}>
        <Icon name="upload" size={16} />
        {t('myData.importAttributes')}
      </Button>
      <Button variant="primary" size="medium" onClick={onSave} disabled={loading || saveDisabled}>
        {!loading && <Icon name="save" size={16} />}
        {loading ? t('common.savingChanges') : t('common.saveChanges')}
      </Button>
    </>
  )
}

export default AttributeImportActions
