import { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import Icon from './Icon'

const SEARCH_THRESHOLD = 8

/**
 * Selector múltiple con checkboxes. Sustituye a <select multiple size=1>, que en
 * escritorio exige Ctrl+clic y en móvil apenas se entiende.
 * options: [{ value, label }] · value: string[]
 */
const MultiSelect = ({ label, options, value, onChange, placeholder, disabled = false }) => {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listId = useId()
  const labelId = useId()

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const selected = new Set(value)
  const toggleValue = (optionValue) => {
    const next = selected.has(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue]
    onChange(next)
  }

  const close = () => {
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      close()
    }
  }

  const summary = (() => {
    if (value.length === 0) return placeholder || t('multiSelect.all')
    if (value.length === 1) return options.find((o) => o.value === value[0])?.label ?? value[0]
    return t('multiSelect.selectedCount').replace('{count}', value.length)
  })()

  const normalizedQuery = query.trim().toLowerCase()
  const visible = normalizedQuery
    ? options.filter((o) => String(o.label).toLowerCase().includes(normalizedQuery))
    : options

  return (
    <div className="multi-select" ref={rootRef} onKeyDown={onKeyDown}>
      {label && <span id={labelId} className="field-label">{label}</span>}
      <button
        ref={triggerRef}
        type="button"
        className={`multi-select-trigger${value.length ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={label ? `${labelId} ${listId}-summary` : undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span id={`${listId}-summary`} className="multi-select-summary">{summary}</span>
        {value.length > 1 && <span className="multi-select-count" aria-hidden="true">{value.length}</span>}
        <Icon name="chevronDown" size={16} className="multi-select-chevron" />
      </button>

      {open && (
        <div className="multi-select-menu">
          {options.length >= SEARCH_THRESHOLD && (
            <div className="multi-select-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('multiSelect.search')}
                aria-label={t('multiSelect.search')}
                autoFocus
              />
            </div>
          )}
          <ul id={listId} role="listbox" aria-multiselectable="true" className="multi-select-list">
            {visible.map((option) => {
              const isSelected = selected.has(option.value)
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="multi-select-option"
                    onClick={() => toggleValue(option.value)}
                  >
                    <span className="multi-select-check" aria-hidden="true">
                      {isSelected && <Icon name="check" size={14} strokeWidth={2.5} />}
                    </span>
                    <span>{option.label}</span>
                  </button>
                </li>
              )
            })}
            {visible.length === 0 && <li className="multi-select-empty">{t('multiSelect.noMatches')}</li>}
          </ul>
          {value.length > 0 && (
            <div className="multi-select-footer">
              <button type="button" className="ghost-button small" onClick={() => onChange([])}>
                {t('multiSelect.clear')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MultiSelect
