interface TablePlaceholderProps {
  /** Column headers describing the eventual table structure. */
  columns?: string[]
  /** Footnote shown under the skeleton. */
  note?: string
  /** Number of skeleton rows to render. */
  rows?: number
}

const DEFAULT_COLUMNS = [
  'Settlement date',
  'Period',
  'Start (UTC)',
  'Forecast MW',
  'Actual MW',
  'Error MW',
]

/**
 * Skeleton for a data table section. Column headers describe the eventual
 * structure; rows are empty skeleton bars — no mock values are shown.
 */
export function TablePlaceholder({
  columns = DEFAULT_COLUMNS,
  note = 'Records will populate this table once data is connected.',
  rows = 6,
}: TablePlaceholderProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-slate-800/60">
              {columns.map((col) => (
                <td key={col} className="px-3 py-3">
                  <div className="h-3.5 w-full max-w-[90px] animate-pulse rounded bg-slate-800" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-center text-xs text-slate-600">{note}</p>
    </div>
  )
}
