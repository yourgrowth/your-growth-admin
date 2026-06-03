type Column = {
  key: string
  label: string
}

type Row = Record<string, React.ReactNode>

type DataTableProps = {
  columns: Column[]
  rows: Row[]
}

export default function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div
      className="w-full overflow-x-auto rounded-lg"
      style={{ border: '1px solid #1a2332' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #1a2332', background: '#0d1117' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#7d8fa3' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: i < rows.length - 1 ? '1px solid #1a2332' : undefined,
                background: '#080b0f',
              }}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3" style={{ color: '#e6edf3' }}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm"
                style={{ color: '#7d8fa3' }}
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
