import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from './LanguageContext'
import Modal from '../components/ui/Modal'
import Icon from '../components/ui/Icon'

const FeedbackContext = createContext(null)

const TOAST_DURATION = { success: 3500, info: 4000, error: 6000 }

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((type, message) => {
    const id = ++nextId.current
    setToasts((prev) => [...prev.slice(-3), { id, type, message }])
    setTimeout(() => dismiss(id), TOAST_DURATION[type])
  }, [dismiss])

  const toast = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }), [push])

  // Promesa: resuelve true al confirmar, false al cancelar o cerrar
  const confirm = useCallback((options) => new Promise((resolve) => {
    setDialog({ ...options, resolve })
  }), [])

  const closeDialog = (result) => {
    dialog?.resolve(result)
    setDialog(null)
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((item) => (
            <div key={item.id} className={`toast toast-${item.type}`} role={item.type === 'error' ? 'alert' : undefined}>
              <ToastIcon type={item.type} />
              <span className="toast-message">{item.message}</span>
              <button type="button" className="toast-close" onClick={() => dismiss(item.id)} aria-label="Cerrar">
                <Icon name="close" size={16} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
      {dialog && <ConfirmDialog dialog={dialog} onClose={closeDialog} />}
    </FeedbackContext.Provider>
  )
}

const TOAST_ICON_PATHS = {
  success: 'M5 12.5l4.5 4.5L19 7.5',
  error: 'M12 7.5v5.5M12 16.5h.01',
  info: 'M12 11v5.5M12 7.5h.01',
}

function ToastIcon({ type }) {
  return (
    <span className="toast-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path d={TOAST_ICON_PATHS[type]} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  )
}

function ConfirmDialog({ dialog, onClose }) {
  const { t } = useLanguage()
  // En acciones destructivas el foco empieza en Cancelar: un Enter despistado no borra nada
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)

  return (
    <Modal
      open
      size="sm"
      role="alertdialog"
      title={dialog.title || t('feedback.confirmTitle')}
      onClose={() => onClose(false)}
      initialFocusRef={dialog.danger ? cancelRef : confirmRef}
      className="confirm-dialog"
      overlayClassName="modal-overlay-top"
      footer={(
        <>
          <button ref={cancelRef} type="button" className="ghost-button" onClick={() => onClose(false)}>
            {dialog.cancelLabel || t('common.cancel')}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={dialog.danger ? 'primary-button danger' : 'primary-button'}
            onClick={() => onClose(true)}
          >
            {dialog.confirmLabel || t('feedback.confirm')}
          </button>
        </>
      )}
    >
      {dialog.message && <p>{dialog.message}</p>}
    </Modal>
  )
}

export const useFeedback = () => {
  const context = useContext(FeedbackContext)
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider')
  return context
}
