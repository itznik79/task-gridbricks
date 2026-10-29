import { useQuery } from '@tanstack/react-query'
import { fetchAccuracy } from '../api/analytics'
import { KpiCard } from './KpiCard'

/** Round to whole MW with locale thousands separators; null stays null. */
function formatMw(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  return Math.round(v).toLocaleString('en-GB')
}

/** Like formatMw but prefixes a + for positive values (bias direction). */
function formatSignedMw(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  const rounded = Math.round(v)
  return (rounded > 0 ? '+' : '') + rounded.toLocaleString('en-GB')
}

function formatCount(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  return v.toLocaleString('en-GB')
}

/**
 * Accuracy KPI grid backed by GET /api/v1/analysis/accuracy (M6.2).
 * Shared by the Overview and Accuracy pages — TanStack Query caches the
 * single ['accuracy'] query so both render from one request.
 */
export function KpiCards() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accuracy'],
    queryFn: fetchAccuracy,
  })

  const metricHint = data ? `${formatCount(data.paired_count)} paired intervals` : undefined
  const missingHint = data
    ? `${formatCount(data.missing_forecast_count)} missing forecasts`
    : undefined

  const kpis: { label: string; unit?: string; value: string | null; hint?: string }[] = [
    { label: 'Mean absolute error', unit: 'MW', value: formatMw(data?.mae_mw), hint: metricHint },
    {
      label: 'Root mean square error',
      unit: 'MW',
      value: formatMw(data?.rmse_mw),
      hint: metricHint,
    },
    { label: 'Mean bias', unit: 'MW', value: formatSignedMw(data?.mean_bias_mw), hint: metricHint },
    { label: 'Paired samples', value: formatCount(data?.paired_count), hint: missingHint },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.label}
          label={kpi.label}
          unit={kpi.unit}
          value={kpi.value}
          hint={kpi.hint}
          isLoading={isLoading}
          isError={isError}
        />
      ))}
    </div>
  )
}
