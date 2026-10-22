import { useId } from 'react'

/** Interruptor on/off. Es un <button role="switch">: se activa con Espacio/Enter y lo anuncia el lector. */
const Toggle = ({ checked, onChange, label, description, disabled = false, id }) => {
  const autoId = useId()
  const switchId = id || autoId
  return (
    <div className={`toggle-field${disabled ? ' is-disabled' : ''}`}>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="toggle"
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" aria-hidden="true" />
      </button>
      {label && (
        <label htmlFor={switchId} className="toggle-label">
          <span>{label}</span>
          {description && <span className="toggle-description">{description}</span>}
        </label>
      )}
    </div>
  )
}

export default Toggle
