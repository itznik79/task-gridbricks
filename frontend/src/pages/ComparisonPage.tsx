import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchComparison } from '../api/analytics'
import { PageIntro } from '../components/PageIntro'
import { Panel } from '../components/Panel'
import { ComparisonChart } from '../components/ComparisonChart'
import { DataTable, type TableColumn } from '../components/DataTable'
import { Pagination } from '../components/Pagination'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { formatInt, formatSignedInt, formatUtcDate, formatUtcDateTime } from '../lib/format'

// One delivery day = 48 half-hourly settlement periods, so each page frames a day.
const PAGE_SIZE = 48

// Defaults and bounds match the ingested dataset (January 2026).
const DEFAULT_START = '2026-01-01'
const DEFAULT_END = '2026-01-31'
const DATASET_MIN = '2026-01-01'
const DATASET_MAX = '2026-01-31'

const COLUMNS: TableColumn[] = [
  { header: 'Settlement date' },
  { header: 'Period', align: 'right' },
  { header: 'Start (UTC)' },
  { header: 'Forecast MW', align: 'right' },
  { header: 'Actual MW', align: 'right' },
  { header: 'Error MW', align: 'right' },
]

export function ComparisonPage() {
  const [startDate, setStartDate] = useState(DEFAULT_START)
  const [endDate, setEndDate] = useState(DEFAULT_END)
  const [offset, setOffset] = useState(0)

  // ISO date strings compare lexicographically === chronologically.
  const rangeError =
    !startDate || !endDate
      ? 'Select a start and end date.'
      : endDate < startDate
        ? 'End date must be on or after start date.'
        : null
  const valid = rangeError === null

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['comparison', startDate, endDate, offset],
    queryFn: () =>
      fetchComparison({
        delivery_start: startDate,
        delivery_end: endDate,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: valid,
    placeholderData: keepPreviousData,
  })

  const items = valid ? (data?.items ?? []) : []
  const total = valid ? (data?.total ?? 0) : 0
  const missing = valid ? (data?.missing_forecast_count ?? 0) : 0

  // Changing the range always returns to the first page.
  const changeStart = (v: string) => {
    setStartDate(v)
    setOffset(0)
  }
  const changeEnd = (v: string) => {
    setEndDate(v)
    setOffset(0)
  }

  return (
    <>
      <PageIntro
        title="Forecast vs. actual comparison"
        description="Aligned day-ahead forecasts and actuals with per-interval error. Only intervals with an eligible forecast are shown."
      />

      <DateRangeFilter
        start={startDate}
        end={endDate}
        onStartChange={changeStart}
        onEndChange={changeEnd}
        min={DATASET_MIN}
        max={DATASET_MAX}
        error={rangeError}
      />

      {valid && missing > 0 && (
        <p className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-400">
          {formatInt(missing)} interval{missing === 1 ? '' : 's'} have no eligible day-ahead
          forecast and are excluded from this comparison to avoid misleading pairings.
        </p>
      )}

      <Panel
        title="Forecast vs. actual generation"
        description="Half-hourly actuals aligned with the selected day-ahead forecast (current page)."
      >
        <ComparisonChart items={items} isLoading={valid && isLoading} isError={isError} />
      </Panel>

      <Panel title="Interval comparison" description="Per-period forecast error detail.">
        <DataTable
          columns={COLUMNS}
          rows={items}
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
          isLoading={valid && isLoading}
          isError={isError}
          emptyMessage={
            valid ? 'No comparison records for this range.' : 'Enter a valid date range to view data.'
          }
        />
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={total}
          onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          onNext={() => setOffset((o) => o + PAGE_SIZE)}
          disabled={isFetching || !valid}
        />
      </Panel>
    </>
  )
}
