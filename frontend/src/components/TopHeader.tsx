import { StatusBadge } from './StatusBadge'

interface TopHeaderProps {
  title: string
  subtitle: string
  onMenuClick: () => void
}

export function TopHeader({ title, subtitle, onMenuClick }: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 lg:hidden"
            aria-label="Open navigation"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
              {title}
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">{subtitle}</p>
          </div>
        </div>
        <StatusBadge />
      </div>
    </header>
  )
}
