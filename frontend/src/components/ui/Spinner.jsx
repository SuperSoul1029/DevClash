function Spinner({ size = 'md', label = 'Loading' }) {
  const className = `spinner spinner--${size}`

  return (
    <span className="spinner-wrap" role="status" aria-live="polite" aria-label={label}>
      <span className={className} />
    </span>
  )
}

export default Spinner
