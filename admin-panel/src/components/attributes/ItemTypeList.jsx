import { useLanguage } from '../../contexts/LanguageContext'
import { displayItemType } from '../../lib/attributeTypes'

/** Panel izquierdo: un botón por tipo de item con sus recuentos. */
const ItemTypeList = ({ types, selected, companyName, onSelect }) => {
  const { t } = useLanguage()

  return (
    <nav className="type-list" aria-label={t('attributes.itemTypes')}>
      {types.map((type) => (
        <button
          key={type.itemType}
          type="button"
          className="type-card"
          aria-pressed={selected === type.itemType}
          onClick={() => onSelect(type.itemType)}
          title={type.itemType}
        >
          <span className="type-card-name">{displayItemType(type.itemType, companyName)}</span>
          <span className="type-card-meta">
            {t('attributes.attributeCount').replace('{count}', type.attributes)}
            {' · '}
            {t('attributes.itemCount').replace('{count}', type.items)}
          </span>
        </button>
      ))}
    </nav>
  )
}

export default ItemTypeList
