const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  onClick,
  type = 'button',
  style,
  ...props 
}) => {
  const getClassName = () => {
    let classes = ['button']
    classes.push(`button-${variant}`)
    classes.push(`button-${size}`)
    if (disabled) classes.push('button-disabled')
    return classes.join(' ')
  }

  return (
    <button
      type={type}
      className={getClassName()}
      onClick={onClick}
      disabled={disabled}
      style={style}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
