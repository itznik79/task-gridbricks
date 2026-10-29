import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar, NAV_ITEMS } from './components/Sidebar'
import { TopHeader } from './components/TopHeader'
import { OverviewPage } from './pages/OverviewPage'
import { ForecastsPage } from './pages/ForecastsPage'
import { ActualsPage } from './pages/ActualsPage'
import { AccuracyPage } from './pages/AccuracyPage'
import { ComparisonPage } from './pages/ComparisonPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function renderPage(activeId: string, onNavigate: (id: string) => void) {
  switch (activeId) {
    case 'forecasts':
      return <ForecastsPage />
    case 'actuals':
      return <ActualsPage />
    case 'accuracy':
      return <AccuracyPage />
    case 'comparison':
      return <ComparisonPage />
    case 'overview':
    default:
      return <OverviewPage onViewComparison={() => onNavigate('comparison')} />
  }
}

function Dashboard() {
  const [activeId, setActiveId] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeId)?.label ?? 'Overview'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar
        activeId={activeId}
        onSelect={setActiveId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-64">
        <TopHeader
          title={activeLabel}
          subtitle="Day-ahead purchasing analytics · January 2026"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {renderPage(activeId, setActiveId)}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
