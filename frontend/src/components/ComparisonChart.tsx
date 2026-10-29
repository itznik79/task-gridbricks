import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ComparisonInterval } from '../api/analytics'
import { formatInt, formatUtcDateTime, formatUtcTime } from '../lib/format'

const HEIGHT = 320

interface ComparisonChartProps {
  items: ComparisonInterval[]
  isLoading?: boolean
  isError?: boolean
}

function StateBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/40 text-sm text-slate-500"
      style={{ height: HEIGHT }}
    >
      {children}
    </div>
  )
}

/**
 * Responsive line chart comparing actual vs. day-ahead forecast generation.
 * Only paired intervals are plotted (the API excludes missing forecasts), so
 * no gaps are filled with fabricated values.
 */
export function ComparisonChart({ items, isLoading = false, isError = false }: ComparisonChartProps) {
  if (isLoading) {
    return (
      <StateBox>
        <span className="h-3 w-40 animate-pulse rounded bg-slate-800" />
      </StateBox>
    )
  }
  if (isError) {
    return <StateBox>{<span className="text-red-300">Could not load comparison data.</span>}</StateBox>
  }
  if (items.length === 0) {
    return <StateBox>No comparison data for this range.</StateBox>
  }

  const chartData = items.map((it) => ({
    t: it.start_time,
    actual: it.actual_mw,
    forecast: it.forecast_mw,
  }))

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="t"
          tickFormatter={(v: string) => formatUtcTime(v)}
          stroke="#64748b"
          fontSize={12}
          minTickGap={40}
          tickMargin={8}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          width={56}
          tickFormatter={(v: number) => formatInt(v)}
          label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#cbd5e1' }}
          itemStyle={{ color: '#e2e8f0' }}
          labelFormatter={(label) => formatUtcDateTime(String(label))}
          formatter={(value) => `${formatInt(Number(value))} MW`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="#38bdf8"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
