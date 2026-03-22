function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || subtitle || action) && (
        <header className="card__header">
          <div>
            {title ? <h3 className="card__title">{title}</h3> : null}
            {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  )
}

export default Card
