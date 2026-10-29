import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  description?: string
  /** Optional right-aligned header slot (e.g. controls, filters). */
  action?: ReactNode
  children: ReactNode
}

/** Section container with a titled header. Reused for chart and table sections. */
export function Panel({ title, description, action, children }: PanelProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
