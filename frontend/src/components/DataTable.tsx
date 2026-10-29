import type { ReactNode } from 'react'

export interface TableColumn {
  header: string
  align?: 'left' | 'right'
}

interface DataTableProps<T> {
  columns: TableColumn[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  /** Cell contents in column order; wrapped in <td> with the column's alignment. */
  rowCells: (row: T) => ReactNode[]
  isLoading?: boolean
  isError?: boolean
  emptyMessage?: string
  errorMessage?: string
  skeletonRows?: number
  note?: string
}

function alignClass(align: TableColumn['align']): string {
  return align === 'right' ? 'text-right' : 'text-left'
}

/**
 * Reusable data table with consistent loading / error / empty states.
 * Styling matches the existing placeholder tables.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowCells,
  isLoading = false,
  isError = false,
  emptyMessage = 'No records for this range.',
  errorMessage = 'Could not load data.',
  skeletonRows = 8,
  note,
}: DataTableProps<T>) {
  const colCount = columns.length

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 ${alignClass(col.align)}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-slate-800/60">
                {columns.map((col) => (
                  <td key={col.header} className="px-3 py-3">
                    <div
                      className={`h-3.5 w-full max-w-[90px] animate-pulse rounded bg-slate-800 ${
                        col.align === 'right' ? 'ml-auto' : ''
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : isError ? (
            <tr>
              <td colSpan={colCount} className="px-3 py-10 text-center text-sm text-red-300">
                {errorMessage}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-3 py-10 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className="border-b border-slate-800/60 hover:bg-slate-800/30"
              >
                {rowCells(row).map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className={`px-3 py-3 text-slate-300 ${alignClass(columns[cellIdx]?.align)}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {note && <p className="mt-4 text-center text-xs text-slate-600">{note}</p>}
    </div>
  )
}
