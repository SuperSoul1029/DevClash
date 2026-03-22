function ChartFrame({ title, caption, children }) {
  return (
    <figure className="chart-frame" aria-label={title}>
      <figcaption>
        <strong>{title}</strong>
        {caption ? <p>{caption}</p> : null}
      </figcaption>
      <div className="chart-frame__plot">{children}</div>
    </figure>
  )
}

export default ChartFrame
