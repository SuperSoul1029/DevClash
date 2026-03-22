function DataTable({ columns, rows, emptyMessage = 'No data available yet.' }) {
  if (!rows.length) {
    return <p className="empty-copy">{emptyMessage}</p>
  }

  return (
    <div className="table-wrap" role="region" aria-label="Data table">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={`${row.id}-${column.key}`}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
