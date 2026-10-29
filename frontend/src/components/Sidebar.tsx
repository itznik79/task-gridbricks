import type { ReactNode } from 'react'

export interface NavItem {
  id: string
  label: string
  icon: ReactNode
}

/** Dashboard navigation sections. Selection is visual only until data is wired. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <GridIcon /> },
  { id: 'forecasts', label: 'Forecasts', icon: <WindIcon /> },
  { id: 'actuals', label: 'Actuals', icon: <BoltIcon /> },
  { id: 'accuracy', label: 'Accuracy', icon: <TargetIcon /> },
  { id: 'comparison', label: 'Comparison', icon: <ScaleIcon /> },
]

interface SidebarProps {
  activeId: string
  onSelect: (id: string) => void
  /** Mobile drawer open state. On large screens the sidebar is always visible. */
  open: boolean
  onClose: () => void
}

export function Sidebar({ activeId, onSelect, open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900',
          'transition-transform duration-200 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
            <WindIcon />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-slate-100">Wind Analytics</p>
            <p className="text-xs text-slate-500">Forecast accuracy</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id)
                  onClose()
                }}
                className={[
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sky-500/10 text-sky-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <span className={active ? 'text-sky-400' : 'text-slate-500'}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 px-5 py-4">
          <p className="text-xs text-slate-500">January 2026 dataset</p>
          <p className="mt-0.5 text-xs text-slate-600">Day-ahead purchasing</p>
        </div>
      </aside>
    </>
  )
}

/* ---- icons (heroicons-style, 1.5 stroke) ---- */

function iconProps() {
  return {
    className: 'h-5 w-5',
    fill: 'none',
    viewBox: '0 0 24 24',
    strokeWidth: 1.5,
    stroke: 'currentColor',
  } as const
}

function GridIcon() {
  return (
    <svg {...iconProps()}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25A2.25 2.25 0 018.25 10.5H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  )
}

function WindIcon() {
  return (
    <svg {...iconProps()}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 9h10.5a2.25 2.25 0 10-2.25-2.25M3.75 15h13.5a2.25 2.25 0 11-2.25 2.25M3.75 12h7.5a2.25 2.25 0 10-2.25-2.25"
      />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg {...iconProps()}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg {...iconProps()}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-4.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0-2.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
      />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg {...iconProps()}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v18M5.25 6l-2.25 6a3 3 0 004.5 0L5.25 6zm0 0h13.5m0 0l-2.25 6a3 3 0 004.5 0L18.75 6zM6.75 21h10.5"
      />
    </svg>
  )
}
