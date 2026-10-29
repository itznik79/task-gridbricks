interface PaginationProps {
  offset: number
  limit: number
  total: number
  onPrev: () => void
  onNext: () => void
  /** Disable controls while a page is being fetched. */
  disabled?: boolean
}

const BTN =
  'rounded-lg border border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'

export function Pagination({ offset, limit, total, onPrev, onNext, disabled = false }: PaginationProps) {
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + limit, total)
  const canPrev = offset > 0 && !disabled
  const canNext = offset + limit < total && !disabled

  return (
    <div className="mt-4 flex items-center justify-between gap-4 text-sm">
      <p className="text-slate-500">
        {total === 0 ? (
          'No records'
        ) : (
          <>
            Showing{' '}
            <span className="text-slate-300">
              {start.toLocaleString('en-GB')}–{end.toLocaleString('en-GB')}
            </span>{' '}
            of {total.toLocaleString('en-GB')}
          </>
        )}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onPrev} disabled={!canPrev} className={BTN}>
          Previous
        </button>
        <button type="button" onClick={onNext} disabled={!canNext} className={BTN}>
          Next
        </button>
      </div>
    </div>
  )
}
