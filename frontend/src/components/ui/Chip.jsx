function Chip({ children, tone = 'neutral' }) {
  return <span className={`chip chip--${tone}`}>{children}</span>
}

export default Chip
