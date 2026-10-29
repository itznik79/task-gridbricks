import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchForecasts } from '../api/wind'
import { PageIntro } from '../components/PageIntro'
import { Panel } from '../components/Panel'
import { DataTable, type TableColumn } from '../components/DataTable'
import { Pagination } from '../components/Pagination'
import { formatInt, formatUtcDateTime } from '../lib/format'

const PAGE_SIZE = 50

const COLUMNS: TableColumn[] = [
  { header: 'Delivery start (UTC)' },
  { header: 'Publish time (UTC)' },
  { header: 'Forecast MW', align: 'right' },
]

export function ForecastsPage() {
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['forecasts', offset],
    queryFn: () => fetchForecasts({ limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  })

  const total = data?.total ?? 0

  return (
    <>
      <PageIntro
        title="Wind forecasts"
        description="Hourly WINDFOR forecast publications. All versions are listed; look-ahead filtering is applied in the accuracy analysis."
      />

      <Panel
        title="Forecast publications"
        description="Delivery hour, publication time, and forecast generation."
      >
        <DataTable
          columns={COLUMNS}
          rows={data?.items ?? []}
          rowKey={(row) => `${row.start_time}__${row.publish_time}`}
          rowCells={(row) => [
            formatUtcDateTime(row.start_time),
            formatUtcDateTime(row.publish_time),
            formatInt(row.generation_mw),
          ]}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="No forecasts for this range."
        />
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={total}
          onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          onNext={() => setOffset((o) => o + PAGE_SIZE)}
          disabled={isFetching}
        />
      </Panel>
    </>
  )
}
