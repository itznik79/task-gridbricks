interface DateRangeFilterProps {
  start: string
  end: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  min?: string
  max?: string
  /** Validation message to show below the inputs, if any. */
  error?: string | null
}

const INPUT =
  'rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 [color-scheme:dark] focus:border-sky-500 focus:outline-none'

/** Start/end date controls using native date inputs, styled for the dark theme. */
export function DateRangeFilter({
  start,
  end,
  onStartChange,
  onEndChange,
  min,
  max,
  error,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">From</span>
          <input
            type="date"
            value={start}
            min={min}
            max={max}
            onChange={(e) => onStartChange(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">To</span>
          <input
            type="date"
            value={end}
            min={min}
            max={max}
            onChange={(e) => onEndChange(e.target.value)}
            className={INPUT}
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
