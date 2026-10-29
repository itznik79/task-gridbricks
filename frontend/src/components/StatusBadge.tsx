import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../api/health'

/**
 * Live API connectivity indicator for the header.
 * Reuses the existing health query — no new API surface is added here.
 */
export function StatusBadge() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  })

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
        Checking…
      </span>
    )
  }

  if (isError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-sm text-red-300">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        API offline
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {data?.service} — {data?.status}
    </span>
  )
}
