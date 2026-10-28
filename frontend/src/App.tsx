import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fetchHealth } from './api/health'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function StatusBadge() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  })

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Checking…
      </span>
    )
  }

  if (isError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        API offline
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      {data?.service} — {data?.status}
    </span>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                UK Wind Forecast &amp; Accuracy
              </h1>
              <p className="mt-0.5 text-sm text-slate-400">
                Day-ahead purchasing analytics · January 2026
              </p>
            </div>
            <StatusBadge />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10">
              <svg
                className="h-7 w-7 text-sky-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-slate-200">Foundation ready</h2>
            <p className="mt-2 text-sm text-slate-400">
              Elexon ingestion, forecast selection, and analytics charts will appear here in the
              next milestone.
            </p>
          </div>
        </main>
      </div>
    </QueryClientProvider>
  )
}
