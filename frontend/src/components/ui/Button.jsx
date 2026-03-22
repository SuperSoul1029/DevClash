import Spinner from './Spinner.jsx'

function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const classes = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner size="sm" label="Submitting" /> : null}
      <span>{children}</span>
    </button>
  )
}

export default Button
