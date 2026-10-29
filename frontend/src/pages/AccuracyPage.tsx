import { useQuery } from '@tanstack/react-query'
import { fetchAccuracy } from '../api/analytics'
import { PageIntro } from '../components/PageIntro'
import { KpiCards } from '../components/KpiCards'
import { Panel } from '../components/Panel'

function MethodologySection() {
  // Reads the same cached ['accuracy'] query as the KPI cards — no extra request.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accuracy'],
    queryFn: fetchAccuracy,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-full max-w-xl animate-pulse rounded bg-slate-800" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return <p className="text-sm text-red-300">Could not load methodology.</p>
  }

  const { methodology } = data
  const rows: { term: string; value: string }[] = [
    { term: 'Decision cutoff', value: methodology.decision_cutoff },
    { term: 'Forecast resolution', value: methodology.forecast_resolution },
    { term: 'Actual resolution', value: methodology.actual_resolution },
    { term: 'Alignment', value: methodology.alignment },
  ]

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.term}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {row.term}
            </dt>
            <dd className="mt-1 text-sm text-slate-300">{row.value}</dd>
          </div>
        ))}
      </dl>

      {methodology.notes.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
          <ul className="mt-2 space-y-1.5">
            {methodology.notes.map((note) => (
              <li key={note} className="flex gap-2 text-sm text-slate-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function AccuracyPage() {
  return (
    <>
      <PageIntro
        title="Forecast accuracy"
        description="Aggregate error metrics and the assumptions behind them."
      />

      <KpiCards />

      <Panel
        title="Methodology"
        description="Current modelling assumptions — not independently verified market rules."
      >
        <MethodologySection />
      </Panel>
    </>
  )
}
