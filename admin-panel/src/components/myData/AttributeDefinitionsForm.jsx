import { useLanguage } from '../../contexts/LanguageContext'
import { ATTRIBUTE_TYPES } from '../../lib/attributeTypes'
import Icon from '../ui/Icon'

// La lista de opciones necesita definir sus opciones: se crea desde el editor individual
const BULK_TYPES = ATTRIBUTE_TYPES.filter((type) => type.value !== 'options')

/** Tabla de alta en lote (nuevo tipo de item o importación desde Excel). */
const AttributeDefinitionsForm = ({ newDefinitions, handleNewDefinitionChange, handleRemoveRow }) => {
  const { t } = useLanguage()

  return (
    <div className="bulk-table-wrap" role="region" aria-label={t('attributes.bulkTableLabel')} tabIndex={0}>
      <table className="bulk-table">
        <thead>
          <tr>
            <th scope="col">{t('attributes.labelEs')}</th>
            <th scope="col">{t('attributes.type')}</th>
            <th scope="col" className="is-center">{t('attributes.filterable')}</th>
            <th scope="col" className="is-center">{t('attributes.required')}</th>
            <th scope="col"><span className="visually-hidden">{t('common.actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {newDefinitions.map((def, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  className="input"
                  value={def.label}
                  onChange={(e) => handleNewDefinitionChange(index, 'label', e.target.value)}
                  placeholder={t('attributes.labelPlaceholder')}
                  aria-label={`${t('attributes.labelEs')} ${index + 1}`}
                />
              </td>
              <td>
                <select
                  className="select"
                  value={def.data_type}
                  onChange={(e) => handleNewDefinitionChange(index, 'data_type', e.target.value)}
                  aria-label={`${t('attributes.type')} ${index + 1}`}
                >
                  {BULK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{t(`attributes.types.${type.value}`)}</option>
                  ))}
                </select>
              </td>
              <td className="is-center">
                <input
                  type="checkbox"
                  checked={def.is_filterable}
                  onChange={(e) => handleNewDefinitionChange(index, 'is_filterable', e.target.checked)}
                  aria-label={`${t('attributes.filterable')} ${index + 1}`}
                />
              </td>
              <td className="is-center">
                <input
                  type="checkbox"
                  checked={def.is_required}
                  onChange={(e) => handleNewDefinitionChange(index, 'is_required', e.target.checked)}
                  aria-label={`${t('attributes.required')} ${index + 1}`}
                />
              </td>
              <td className="is-center">
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => handleRemoveRow(index)}
                  disabled={newDefinitions.length === 1}
                  aria-label={t('attributes.removeRow').replace('{n}', index + 1)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AttributeDefinitionsForm
