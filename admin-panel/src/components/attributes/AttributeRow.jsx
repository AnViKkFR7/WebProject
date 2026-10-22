import { useLanguage } from '../../contexts/LanguageContext'
import { parseLabel, typeMeta, uiTypeOf } from '../../lib/attributeTypes'
import Icon from '../ui/Icon'
import Toggle from '../ui/Toggle'

/**
 * Un atributo: tipo con nombre humano, interruptores reales y acciones.
 * Se reordena arrastrando (ratón) o con los botones subir/bajar (teclado y táctil).
 */
const AttributeRow = ({
  definition,
  index,
  total,
  canEdit,
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const { t } = useLanguage()
  const uiType = uiTypeOf(definition)
  const meta = typeMeta(uiType)
  const label = parseLabel(definition.label)
  const isDragging = dragState?.from === index
  const isTarget = dragState?.over === index && dragState.from !== index

  return (
    <li
      className={`attr-row${isDragging ? ' is-dragging' : ''}${isTarget ? ' is-drop-target' : ''}`}
      draggable={canEdit}
      onDragStart={canEdit ? () => onDragStart(index) : undefined}
      onDragEnter={canEdit ? () => onDragEnter(index) : undefined}
      onDragOver={canEdit ? (e) => e.preventDefault() : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
    >
      {canEdit && (
        <span className="attr-row-order">
          <span className="attr-row-handle" aria-hidden="true"><Icon name="move" size={16} /></span>
          <span className="attr-row-arrows">
            <button
              type="button"
              className="icon-button"
              onClick={() => onMove(index, index - 1)}
              disabled={index === 0}
              aria-label={t('attributes.moveUp').replace('{name}', label.es)}
            >
              <Icon name="chevronUp" size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => onMove(index, index + 1)}
              disabled={index === total - 1}
              aria-label={t('attributes.moveDown').replace('{name}', label.es)}
            >
              <Icon name="chevronDown" size={16} />
            </button>
          </span>
        </span>
      )}

      <span className="attr-row-type" title={t(`attributes.types.${uiType}`)}>
        <Icon name={meta.icon} size={18} />
      </span>

      <span className="attr-row-main">
        <span className="attr-row-label">
          {label.es || definition.key}
          {label.en && <span className="attr-row-label-en" lang="en">{label.en}</span>}
        </span>
        <span className="attr-row-meta">
          {t(`attributes.types.${uiType}`)}
          {uiType === 'options' && ` · ${definition.validation_rules.options.length}`}
          <code className="attr-row-key">{definition.key}</code>
        </span>
      </span>

      <span className="attr-row-switches">
        <Toggle
          checked={definition.is_required}
          onChange={(value) => onToggle(definition, 'is_required', value)}
          label={t('attributes.required')}
          disabled={!canEdit}
        />
        <Toggle
          checked={definition.is_filterable}
          onChange={(value) => onToggle(definition, 'is_filterable', value)}
          label={t('attributes.filterable')}
          disabled={!canEdit}
        />
      </span>

      {canEdit && (
        <span className="attr-row-actions">
          <button type="button" className="icon-button" onClick={() => onEdit(definition)} aria-label={t('attributes.editNamed').replace('{name}', label.es)}>
            <Icon name="edit" size={16} />
          </button>
          <button type="button" className="icon-button danger" onClick={() => onDelete(definition)} aria-label={t('attributes.deleteNamed').replace('{name}', label.es)}>
            <Icon name="trash" size={16} />
          </button>
        </span>
      )}
    </li>
  )
}

export default AttributeRow
