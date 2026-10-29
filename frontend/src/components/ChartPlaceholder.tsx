/** Empty-state visual for the main chart section (no data yet). */
export function ChartPlaceholder() {
  return (
    <div className="relative flex h-72 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-800 bg-slate-950/40 sm:h-80">
      {/* faint baseline grid to suggest a chart canvas */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(30 41 59 / 0.5) 1px, transparent 1px), linear-gradient(to top, rgb(30 41 59 / 0.5) 1px, transparent 1px)',
          backgroundSize: '56px 48px',
        }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-slate-500">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.5l4.5-4.5 3 3L18 6m0 0h-3.75M18 6v3.75M3.75 19.5h16.5"
            />
          </svg>
        </span>
        <p className="mt-3 text-sm font-medium text-slate-400">No chart data yet</p>
        <p className="mt-1 max-w-xs text-xs text-slate-600">
          Forecast vs. actual generation will render here once the analytics data is connected.
        </p>
      </div>
    </div>
  )
}
