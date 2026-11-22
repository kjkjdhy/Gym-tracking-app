import { useState } from 'react'
import LogPage from './pages/LogPage'
import PlanPage from './pages/PlanPage'
import HistoryPage from './pages/HistoryPage'
import AIPage from './pages/AIPage'
import SettingsPage from './pages/SettingsPage'

type Tab = 'log' | 'plan' | 'history' | 'ai' | 'settings'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: '记录', icon: '📝' },
  { id: 'plan', label: '计划', icon: '📋' },
  { id: 'history', label: '历史', icon: '📊' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'settings', label: '设置', icon: '⚙️' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('log')

  return (
    <div className="flex flex-col h-screen bg-black text-white max-w-lg mx-auto">
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'log' && <LogPage />}
        {activeTab === 'plan' && <PlanPage />}
        {activeTab === 'history' && <HistoryPage />}
        {activeTab === 'ai' && <AIPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <nav className="flex border-t border-white/5 bg-zinc-950 pb-safe">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
              activeTab === tab.id
                ? 'text-orange-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
