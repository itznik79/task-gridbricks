interface KpiCardProps {
  label: string
  /**
   * Formatted value. `null` means the API returned no value (e.g. no paired
   * samples) — rendered as an em dash, never fabricated. Ignored while loading
   * or on error.
   */
  value?: string | null
  unit?: string
  hint?: string
  isLoading?: boolean
  isError?: boolean
}

/**
 * Reusable KPI tile with explicit loading / error / no-data states.
 * No value is ever invented: nulls render as "—".
 */
export function KpiCard({ label, value, unit, hint, isLoading, isError }: KpiCardProps) {
  const noData = !isLoading && !isError && (value === null || value === undefined)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        {isLoading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-slate-800" />
        ) : isError ? (
          <span className="text-2xl font-semibold tracking-tight text-red-300">Unavailable</span>
        ) : noData ? (
          <span className="text-3xl font-semibold tracking-tight text-slate-600">—</span>
        ) : (
          <>
            <span className="text-3xl font-semibold tracking-tight text-slate-100">{value}</span>
            {unit && <span className="text-sm text-slate-500">{unit}</span>}
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {isError
          ? 'Could not load data'
          : noData
            ? 'No data for this range'
            : (hint ?? 'Awaiting data')}
      </p>
    </div>
  )
}
