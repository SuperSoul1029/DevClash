import { useEffect } from 'react'
import Button from './Button.jsx'

function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h3>{title}</h3>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>
        <div>{children}</div>
      </section>
    </div>
  )
}

export default Modal
