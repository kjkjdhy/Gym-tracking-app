import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function HistoryPage() {
  const logs = useLiveQuery(() =>
    db.workoutLogs.orderBy('date').reverse().limit(30).toArray()
  ) ?? []

  if (logs.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold text-zinc-100 mb-4">训练历史</h1>
        <p className="text-zinc-500 text-center py-12">还没有记录，快去记一次训练吧</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold text-zinc-100">训练历史</h1>
      {logs.map((log) => (
        <div key={log.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-100">{log.date}</span>
            <span className="text-sm text-zinc-500">{log.exercises.length} 个动作</span>
          </div>
          <div className="space-y-1">
            {log.exercises.map((ex, i) => (
              <div key={i} className="text-sm text-zinc-400">
                <span className="text-zinc-300">{ex.exerciseName}</span>
                {' — '}
                {ex.sets.map((s, si) => (
                  <span key={si}>
                    {s.weight}kg×{s.reps}
                    {si < ex.sets.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {log.note && (
            <p className="text-xs text-zinc-500 italic">{log.note}</p>
          )}
        </div>
      ))}
    </div>
  )
}
