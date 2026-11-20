import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { syncToGitHub } from '../lib/github-sync'

export default function AIPage() {
  const settings = useLiveQuery(() => db.settings.orderBy('id').first())
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const lastSync = settings?.lastSyncAt
    ? new Date(settings.lastSyncAt).toLocaleString('zh-CN')
    : '从未同步'

  async function handleSync() {
    const token = settings?.githubToken
    if (!token) { setSyncMsg('请先在设置中填入 GitHub Token'); return }
    setSyncing(true)
    setSyncMsg('')
    try {
      await syncToGitHub(token)
      const existing = await db.settings.orderBy('id').first()
      if (existing) await db.settings.update(existing.id!, { lastSyncAt: Date.now() })
      setSyncMsg('同步成功！现在去 VS Code 运行 git pull')
    } catch (e) {
      setSyncMsg(`同步失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">与 Claude 讨论</h1>

      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
        <p className="text-sm font-medium text-zinc-300">上次同步</p>
        <p className="text-zinc-400 text-sm">{lastSync}</p>
      </div>

      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl font-semibold text-lg transition-colors"
      >
        {syncing ? '同步中...' : '立即同步到电脑'}
      </button>

      {syncMsg && (
        <p className={`text-sm text-center ${syncMsg.includes('失败') ? 'text-red-400' : 'text-green-400'}`}>
          {syncMsg}
        </p>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-zinc-300">使用方法</p>
        <div className="space-y-2">
          {[
            '记录训练后自动同步（需设置 GitHub Token）',
            '或点上方按钮手动同步',
            '电脑 VS Code 终端运行 git pull',
            '对 Claude 说"帮我分析训练数据"',
          ].map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="bg-orange-500/20 text-orange-400 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-zinc-400">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {!settings?.githubToken && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-orange-500/20">
          <p className="text-sm text-orange-400">
            还未设置 GitHub Token，请前往设置页面完成配置
          </p>
        </div>
      )}
    </div>
  )
}
