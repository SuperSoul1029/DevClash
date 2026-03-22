function Badge({ children, status = 'info' }) {
  return <span className={`badge badge--${status}`}>{children}</span>
}

export default Badge
