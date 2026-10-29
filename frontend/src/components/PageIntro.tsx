interface PageIntroProps {
  title: string
  description: string
}

/** Consistent per-page heading block shown at the top of the main content. */
export function PageIntro({ title, description }: PageIntroProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  )
}
