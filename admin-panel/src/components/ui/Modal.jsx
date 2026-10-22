import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import Icon from './Icon'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusableIn = (node) =>
  Array.from(node?.querySelectorAll(FOCUSABLE) || []).filter((el) => el.offsetParent !== null)

/**
 * Diálogo accesible: role="dialog", foco atrapado, Esc cierra y el foco vuelve
 * al elemento que lo abrió. `footer` se pinta fijo bajo un cuerpo con scroll.
 */
const Modal = ({
  open,
  onClose,
  title,
  description,
  icon = 'grid',
  eyebrow,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  initialFocusRef,
  closeOnBackdrop = true,
  className = '',
  overlayClassName = '',
}) => {
  const { t } = useLanguage()
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  // onClose suele ser una arrow nueva en cada render; no debe reiniciar el efecto
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    const dialog = dialogRef.current
    const target = initialFocusRef?.current || focusableIn(dialog)[0] || dialog
    target?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusableIn(dialog)
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog?.addEventListener('keydown', onKeyDown)

    return () => {
      dialog?.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [open, initialFocusRef])

  if (!open) return null

  // mousedown y no click: si el usuario arrastra seleccionando texto y suelta fuera, no se cierra
  const handleBackdrop = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose?.()
  }

  return createPortal(
    <div className={`modal-overlay ${overlayClassName}`.trim()} onMouseDown={handleBackdrop}>
      <div
        ref={dialogRef}
        className={`modal modal-${size} ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {title && (
          <div className="modal-header">
            <div className="modal-heading">
              <span className="modal-heading-icon"><Icon name={role === 'alertdialog' ? 'alert' : icon} size={22}/></span>
              <div className="modal-heading-copy">
              {eyebrow && <span className="modal-eyebrow">{eyebrow}</span>}
              <h3 id={titleId}>{title}</h3>
              {description && <p id={descriptionId} className="modal-description">{description}</p>}
              </div>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
