import { useQuery } from '@tanstack/react-query'
import { fetchComparison } from '../api/analytics'
import { PageIntro } from '../components/PageIntro'
import { KpiCards } from '../components/KpiCards'
import { Panel } from '../components/Panel'
import { ComparisonChart } from '../components/ComparisonChart'
import { DataTable, type TableColumn } from '../components/DataTable'
import { formatInt, formatSignedInt, formatUtcDate, formatUtcDateTime } from '../lib/format'

// One delivery day for the chart preview; the table shows just the first few rows.
const PREVIEW_DAY = 48
const PREVIEW_ROWS = 6

const COLUMNS: TableColumn[] = [
  { header: 'Settlement date' },
  { header: 'Period', align: 'right' },
  { header: 'Start (UTC)' },
  { header: 'Forecast MW', align: 'right' },
  { header: 'Actual MW', align: 'right' },
  { header: 'Error MW', align: 'right' },
]

interface OverviewPageProps {
  onViewComparison: () => void
}

export function OverviewPage({ onViewComparison }: OverviewPageProps) {
  // Same key/params as the Comparison page's first page, so the cache is shared.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['comparison', 0],
    queryFn: () => fetchComparison({ limit: PREVIEW_DAY, offset: 0 }),
  })

  const items = data?.items ?? []
  const tablePreview = items.slice(0, PREVIEW_ROWS)

  const viewAllButton = (
    <button
      type="button"
      onClick={onViewComparison}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-slate-800"
    >
      View full comparison
      <span aria-hidden>→</span>
    </button>
  )

  return (
    <>
      <PageIntro
        title="Forecast accuracy overview"
        description="National wind generation forecasts versus actuals, selected without look-ahead bias."
      />

      <KpiCards />

      <Panel
        title="Forecast vs. actual generation"
        description="Half-hourly actuals aligned with the day-ahead forecast (first delivery day)."
        action={viewAllButton}
      >
        <ComparisonChart items={items} isLoading={isLoading} isError={isError} />
      </Panel>

      <Panel
        title="Recent interval comparison"
        description="A short preview of per-period forecast error."
        action={viewAllButton}
      >
        <DataTable
          columns={COLUMNS}
          rows={tablePreview}
          rowKey={(row) => `${row.settlement_date}__${row.settlement_period}`}
          rowCells={(row) => [
            formatUtcDate(row.settlement_date),
            formatInt(row.settlement_period),
            formatUtcDateTime(row.start_time),
            formatInt(row.forecast_mw),
            formatInt(row.actual_mw),
            <span
              key="error"
              className={
                row.error_mw > 0
                  ? 'text-amber-300'
                  : row.error_mw < 0
                    ? 'text-sky-300'
                    : 'text-slate-300'
              }
            >
              {formatSignedInt(row.error_mw)}
            </span>,
          ]}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="No comparison records available."
          skeletonRows={PREVIEW_ROWS}
        />
      </Panel>
    </>
  )
}
