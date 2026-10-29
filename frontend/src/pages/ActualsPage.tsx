import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchActuals } from '../api/wind'
import { PageIntro } from '../components/PageIntro'
import { Panel } from '../components/Panel'
import { DataTable, type TableColumn } from '../components/DataTable'
import { Pagination } from '../components/Pagination'
import { formatInt, formatUtcDate, formatUtcDateTime } from '../lib/format'

const PAGE_SIZE = 50

const COLUMNS: TableColumn[] = [
  { header: 'Settlement date' },
  { header: 'Period', align: 'right' },
  { header: 'Start (UTC)' },
  { header: 'Publish time (UTC)' },
  { header: 'Generation MW', align: 'right' },
]

export function ActualsPage() {
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['actuals', offset],
    queryFn: () => fetchActuals({ limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  })

  const total = data?.total ?? 0

  return (
    <>
      <PageIntro
        title="Actual generation"
        description="Half-hourly FUELHH national wind generation outturn."
      />

      <Panel
        title="Settlement-period actuals"
        description="One record per 30-minute settlement period."
      >
        <DataTable
          columns={COLUMNS}
          rows={data?.items ?? []}
          rowKey={(row) => `${row.settlement_date}__${row.settlement_period}`}
          rowCells={(row) => [
            formatUtcDate(row.settlement_date),
            formatInt(row.settlement_period),
            formatUtcDateTime(row.start_time),
            formatUtcDateTime(row.publish_time),
            formatInt(row.generation_mw),
          ]}
          isLoading={isLoading}
          isError={isError}
          emptyMessage="No actuals for this range."
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
